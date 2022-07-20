var mysql = require('mysql');

var con = mysql.createConnection({
  host: "localhost",
  user: "Cindy",
  password: "123456789"
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
  con.query("CREATE DATABASE 6452project", function (err, result) {
    if (err) throw err;
    console.log("Database created");
  });
});