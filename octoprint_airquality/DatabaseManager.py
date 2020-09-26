import os
import sqlite3
import sys

class DatabaseManager():
    def __init__(self, plugin):
        self._logger = plugin._logger
        self._logger.info("Starting database manager...")

        self.db_path = os.path.join(plugin.get_plugin_data_folder(), "air_quality.db")
        self.create_database()

    def create_database(self):
        try:
            self._logger.info("Creating database at %s" % self.db_path)
            db = sqlite3.connect(self.db_path)
            cursor = db.cursor()
            cursor.execute(
                '''CREATE TABLE IF NOT EXISTS locations(
                    id          INTEGER PRIMARY KEY,
                    name        TEXT,
                    created     DATETIME,
                    modified    DATETIME DEFAULT CURRENT_TIMESTAMP
                )''')
            cursor.execute(
                '''CREATE TABLE IF NOT EXISTS devices(
                    id          INTEGER PRIMARY KEY,
                    created     DATETIME,
                    modified    DATETIME DEFAULT CURRENT_TIMESTAMP,
                    name        TEXT,
                    location_id,
                    model       TEXT,
                    port        TEXT,
                    FOREIGN KEY(location_id) REFERENCES locations(id)
                )''')
            cursor.execute(
                '''CREATE TABLE IF NOT EXISTS readings(
                    id          INTEGER PRIMARY KEY,
                    device_id,
                    location_id,
                    timestamp   DATETIME DEFAULT CURRENT_TIMESTAMP,
                    pm1         REAL,
                    pm2_5       REAL,
                    pm10        REAL,
                    n0_3        INTEGER,
                    n0_5        INTEGER,
                    n1_0        INTEGER,
                    n2_5        INTEGER,
                    n5_0        INTEGER,
                    n10_0       INTEGER,
                    FOREIGN KEY(device_id) REFERENCES devices(id),
                    FOREIGN KEY(location_id) REFERENCES locations(id)
                )''')
            db.commit()
            db.close()
        except:
            e = sys.exc_info()[0]
            self._logger.error("Error creating database: %s" % e)

    def empty_database(self):
        try:
            self._logger.info("Dropping tables from %s" % self.db_path)
            db = sqlite3.connect(self.db_path)
            cursor = db.cursor()
            cursor.execute('''DROP TABLE IF EXISTS readings;''')
            cursor.execute('''DROP TABLE IF EXISTS devices;''')
            cursor.execute('''DROP TABLE IF EXISTS locations;''')
            db.commit()
            db.close()
        except:
            e = sys.exc_info()[0]
            self._logger.error("Error emptying database: %s" % e)
        self.create_database()

    def insert_device(self, device):
        db = sqlite3.connect(self.db_path)
        cursor = db.cursor()
        cursor.execute('''INSERT INTO devices(created, name, model, port) VALUES(CURRENT_TIMESTAMP,?,?,?)''', [device['name'], device['model'], device['port']])
        db.commit()
        db.close()
        pass

    def insert_location(self, location):
        db = sqlite3.connect(self.db_path)
        cursor = db.cursor()
        cursor.execute('''INSERT INTO locations(created, name) VALUES(CURRENT_TIMESTAMP,?)''', [location['name']])
        db.commit()
        db.close()
        pass

    def insert_reading(self):
        pass

    def populate_test_data(self):
        self.insert_location({
            "name": "Laboratory"
        })
        self.insert_device({
            "name": "test",
            "location_id": "1",
            "model": "A003",
            "port": "COM4"
        })
        pass