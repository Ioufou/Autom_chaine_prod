from fastapi import FastAPI, HTTPException, UploadFile, File, Query, Form, BackgroundTasks
from pydantic import BaseModel
import redis
import json
import csv
import codecs
import io
import shutil
import os
from pymongo import MongoClient
from datetime import datetime
from typing import Optional

app = FastAPI()

r = redis.Redis(host='redis-broker', port=6379, db=0)
mongo_client = MongoClient("mongodb://mongo-db:27017/")
db = mongo_client["logs_db"]
collection = db["logs"]

def process_csv_background(file_path: str, original_filename: str):
    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            queued_count = 0
            for row in reader:
                clean_data = {k.strip(): v for k, v in row.items() if k}
                if not clean_data: continue

                log_entry = {
                    "source_filename": original_filename,
                    "data": clean_data,
                    "timestamp_ingest": datetime.now().isoformat(),
                    "search_index": f"{original_filename} {clean_data.get('Title','')} {clean_data.get('Source','')}"
                }
                
                r.rpush('log_queue', json.dumps(log_entry))
                queued_count += 1
    except Exception as e:
        print(f"Erreur critique traitement background {original_filename}: {str(e)}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@app.post("/upload")
async def upload_log(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    force: bool = Form(False)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Fichier CSV requis.")

    existing_doc = collection.find_one({"source_filename": file.filename}, {"_id": 1})
    if existing_doc:
        if not force:
            raise HTTPException(status_code=409, detail=f"Fichier '{file.filename}' existe déjà.")
        else:
            collection.delete_many({"source_filename": file.filename})

    temp_filename = f"/tmp/{file.filename}"
    
    try:
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur écriture disque: {str(e)}")

    background_tasks.add_task(process_csv_background, temp_filename, file.filename)

    return {
        "status": "success", 
        "filename": file.filename, 
        "count": "En cours...",
        "message": "Fichier reçu. Traitement en cours en arrière-plan."
    }

@app.get("/search")
async def search_logs(
    title: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    destination: Optional[str] = None,
    error_code: Optional[str] = Query(None, alias="error_code"),
    type_obj: Optional[str] = Query(None, alias="type"),
    sub_job_id: Optional[str] = None,
    migration_action: Optional[str] = None,
    filename: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    query_filters = []
    
    if filename:
        query_filters.append({"source_filename": {"$regex": filename, "$options": "i"}})
    if title:
        query_filters.append({"data.Title": {"$regex": title, "$options": "i"}})
    if status:
        query_filters.append({"data.Status": {"$regex": status, "$options": "i"}})
    if source:
        query_filters.append({"data.Source": {"$regex": source, "$options": "i"}})
    if destination:
        query_filters.append({"data.Destination": {"$regex": destination, "$options": "i"}})
    if error_code:
        query_filters.append({"data.Error code": {"$regex": error_code, "$options": "i"}})
    if type_obj:
        query_filters.append({"data.Type": {"$regex": type_obj, "$options": "i"}})
    if sub_job_id:
        query_filters.append({"data.Sub job ID": {"$regex": sub_job_id, "$options": "i"}})
    if migration_action:
        query_filters.append({"data.Migration action": {"$regex": migration_action, "$options": "i"}})

    final_query = {}
    if query_filters:
        final_query = {"$and": query_filters}
    
    results = []
    try:
        cursor = collection.find(final_query).sort("timestamp_ingest", -1).skip(skip).limit(limit)
        
        for doc in cursor:
            doc['_id'] = str(doc['_id'])
            results.append(doc)
    except Exception as e:
        print(f"Erreur Mongo: {e}")
        raise HTTPException(status_code=500, detail="Erreur base de données")
            
    return results

@app.get("/files")
async def list_files():
    try:
        files = collection.distinct("source_filename")
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/files")
async def delete_file(filename: str):
    try:
        result = collection.delete_many({"source_filename": filename})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Fichier non trouvé ou déjà supprimé")
        
        return {
            "status": "success", 
            "message": f"Fichier '{filename}' supprimé ({result.deleted_count} lignes effacées)."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))