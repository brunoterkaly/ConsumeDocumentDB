// load http module
var http = require('http');

var port = process.env.port || 1337;
var DocumentDBClient = require('documentdb').DocumentClient;
var nconf = require('nconf');

// tell nconf which config file to use
nconf.env();
nconf.file({ file: 'config.json' });


// Read the configuration data
var host = nconf.get("HOST");
var authKey = nconf.get("AUTH_KEY");
var databaseId = nconf.get("DATABASE");
var collectionId = nconf.get("COLLECTION");

var client = new DocumentDBClient(host, { masterKey: authKey });

// create http server
http.createServer(function (req, res) {

    console.log('Web Service called');
    // before we can query for Items in the document store, we need to ensure we 
    // have a database with a collection then use the collection to read the documents
    readOrCreateDatabase(function (database) {
        readOrCreateCollection(database, function (collection) {
            // Perform a query to retrieve data and display
            listItems(collection, function (items) {
                var userString = JSON.stringify(items);
                var headers = {
                    'Content-Type': 'application/json',
                    'Content-Length': userString.length
                };
                res.write(userString);
                res.end();
            });
        });
    });


    
}).listen(8124, function () { console.log('bound to port 8124'); });

console.log('Server running on 8124/');



// if the database does not exist, then create it, else return the database object
// uses queryDatabases to check if a database with this name already exists. If we 
// can’ t find one, then we go ahead and use createDatabase to create a new database 
// with the supplied identifier (from our configuration file) on the endpoint 
// specified (also from the configuration file)
var readOrCreateDatabase = function (callback) {
    client.queryDatabases('SELECT * FROM root r WHERE r.id="' + databaseId + '"').toArray(function (err, results) {
        console.log('readOrCreateDatabase');
        
        if (err) {
            // some error occured, rethrow up
            throw (err);
        }
        if (!err && results.length === 0) {
            // no error occured, but there were no results returned 
            // indicating no database exists matching the query            
            client.createDatabase({ id: databaseId }, function (err, createdDatabase) {
                console.log('client.createDatabase');
                callback(createdDatabase);
            });
        } else {
            // we found a database
            console.log('found a database');
            callback(results[0]);
        }
    });
};

// if the collection does not exist for the database provided, create it, else return the collection object
// As with readOrCreateDatabase this method first tried to find a collection with the supplied identifier, 
// if one exists, it is returned and if one does not exist it is created for you. 
var readOrCreateCollection = function (database, callback) {
    client.queryCollections(database._self, 'SELECT * FROM root r WHERE r.id="' + collectionId + '"').toArray(function (err, results) {
        console.log('readOrCreateCollection');
        if (err) {
            // some error occured, rethrow up
            throw (err);
        }
        if (!err && results.length === 0) {
            // no error occured, but there were no results returned 
            //indicating no collection exists in the provided database matching the query
            client.createCollection(database._self, { id: collectionId }, function (err, createdCollection) {
                console.log('client.createCollection');
                callback(createdCollection);
            });
        } else {
            // we found a collection
            console.log('found a collection');
            callback(results[0]);
        }
    });
};


// query the provided collection for all non-complete items
// uses queryDocuments to look for all documents in the collection that are 
// not yet complete, or where completed = false.It uses the DocumentDB query 
// grammar which is based on ANSI - SQL to demonstrate this familiar, yet 
// powerful querying capability. 
var listItems = function (collection, callback) {
    client.queryDocuments(collection._self, 'SELECT r.name,r.category FROM root r WHERE r.completed=false').toArray(function (err, docs) {
        console.log('called listItems');
        if (err) {
            throw (err);
        }
        
        callback(docs);
    });
}