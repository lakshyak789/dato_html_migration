var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database("./logging.db");

export const insertLog = (dato_id: any, log: any, status: any) => {
  db.run(
    "CREATE TABLE IF NOT EXISTS logs(dato_id INTEGER, log TEXT, datetime TEXT, status TEXT  )",
    function (this: any, err: any) {
      if (err) {
        // throw new Error(err.message);
        return console.log(err.message);
      }
      // get the last insert id
    }
  );
  // insert one row into the langs table
  var date = new Date();
  var sqllite_date = date.toISOString();
  db.run(
    `INSERT INTO logs(dato_id, log, datetime, status) VALUES(?,?,?,?)`,
    [dato_id, log, sqllite_date, status],
    function (this: any, err: any) {
      if (err) {
        // throw new Error(err.message);
        return console.log(err.message);
      }
      // get the last insert id

      console.log(`A row has been inserted with rowid ${this.lastID}`);
    }
  );
};
