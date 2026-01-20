using StackExchange.Redis;
using MongoDB.Driver;
using MongoDB.Bson;

var redis = ConnectionMultiplexer.Connect("redis-broker");
var dbRedis = redis.GetDatabase();

var mongoClient = new MongoClient("mongodb://mongo-db:27017");
var dbMongo = mongoClient.GetDatabase("logs_db");
var collection = dbMongo.GetCollection<BsonDocument>("logs");

while (true)
{
    var logJson = dbRedis.ListLeftPop("log_queue");

    if (logJson.HasValue)
    {
        try 
        {
            var document = BsonDocument.Parse(logJson.ToString());
            collection.InsertOne(document);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Erreur de traitement: {ex.Message}");
        }
    }
    else
    {
        Thread.Sleep(100);
    }
}