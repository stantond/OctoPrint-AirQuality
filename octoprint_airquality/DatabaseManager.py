import os
import sqlite3
import sys

class DatabaseManager():
    def __init__(self, plugin):
        self._logger = plugin._logger
        self._logger.info("Starting database manager...")
        self.db_path = os.path.join(plugin.get_plugin_data_folder(), "air_quality.db")
        self.build_test_database()

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
                    port        TEXT DEFAULT NULL,
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
                    n0_3        REAL,
                    n0_5        REAL,
                    n1_0        REAL,
                    n2_5        REAL,
                    n5_0        REAL,
                    n10_0       REAL,
                    FOREIGN KEY(device_id) REFERENCES devices(id),
                    FOREIGN KEY(location_id) REFERENCES locations(id)
                )''')
            cursor.close()
            db.commit()
            db.close()
        except Exception as e:
            self._logger.error("Error creating database: %s" % e)

    def empty_database(self):
        try:
            self._logger.info("Dropping tables from %s" % self.db_path)
            db = sqlite3.connect(self.db_path)
            cursor = db.cursor()
            cursor.execute('''DROP TABLE IF EXISTS readings;''')
            cursor.execute('''DROP TABLE IF EXISTS devices;''')
            cursor.execute('''DROP TABLE IF EXISTS locations;''')
            cursor.close()
            db.commit()
            db.close()
        except Exception as e:
            self._logger.error("Error emptying database: %s" % e)

    def insert_device(self, device):
        try:
            db = sqlite3.connect(self.db_path)
            cursor = db.cursor()
            cursor.execute('''INSERT INTO devices(created, name, location_id, model, port) VALUES(CURRENT_TIMESTAMP,?,?,?,?)''', [device.get('name'), device.get('location_id'), device.get('model'), device.get('port')])
            cursor.close()
            db.commit()
            db.close()
        except Exception as e:
            self._logger.error("Error inserting device into database: %s" % e)

    def insert_location(self, location):
        try:
            db = sqlite3.connect(self.db_path)
            cursor = db.cursor()
            cursor.execute('''INSERT INTO locations(created, name) VALUES(CURRENT_TIMESTAMP,?)''', [location.get('name')])
            cursor.close()
            db.commit()
            db.close()
        except Exception as e:
            self._logger.error("Error inserting location into database: %s" % e)

    def insert_reading(self, device_id, location_id, reading):
        try:
            db = sqlite3.connect(self.db_path)
            cursor = db.cursor()
            cursor.execute('''INSERT INTO readings(
                device_id, location_id, pm1, pm2_5, pm10, n0_3, n0_5, n1_0, n2_5, n5_0, n10_0
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', [
                    device_id, location_id,
                    reading.pm01, reading.pm25, reading.pm10,
                    reading.n0_3, reading.n0_5, reading.n1_0, reading.n2_5, reading.n5_0, reading.n10_0
                ]
            )
            cursor.close()
            db.commit()
            db.close()
        except Exception as e:
            self._logger.error("Error inserting reading into database: %s" % e)

    def get_devices(self):
        try:
            db = sqlite3.connect(self.db_path)
            cursor = db.cursor()
            cursor.execute('''SELECT id, name, created, modified, location_id, model, port FROM devices''')
            devices = [dict(zip([column[0] for column in cursor.description], row)) for row in cursor.fetchall()]
            cursor.close()
            db.close()
            return devices
        except Exception as e:
            self._logger.error("Error getting devices from database: %s" % e)

    def get_locations(self):
        try:
            db = sqlite3.connect(self.db_path)
            cursor = db.cursor()
            cursor.execute('''SELECT id, name, created, modified FROM locations''')
            locations = [dict(zip([column[0] for column in cursor.description], row)) for row in cursor.fetchall()]
            cursor.close()
            db.close()
            return locations
        except Exception as e:
            self._logger.error("Error getting locations from database: %s" % e)

    def update_device(self, device):
        try:
            db = sqlite3.connect(self.db_path)
            cursor = db.cursor()
            cursor.execute('''UPDATE devices SET name=?, location_id=?, model=?, port=? WHERE id=?''', (device.get('name'), device.get('location_id'), device.get('model'), device.get('port'), device.get('id')))
            cursor.close()
            db.commit()
            db.close()
        except Exception as e:
            self._logger.error("Error updating device in database: %s" % e)

    def update_location(self, location):
        try:
            db = sqlite3.connect(self.db_path)
            cursor = db.cursor()
            cursor.execute('''UPDATE locations SET name=? WHERE id=?''', (location.get('name'), location.get('id')))
            cursor.close()
            db.commit()
            db.close()
        except Exception as e:
            self._logger.error("Error updating location in database: %s" % e)

    def delete_device(self, device):
        try:
            db = sqlite3.connect(self.db_path)
            cursor = db.cursor()
            cursor.execute('''DELETE FROM devices WHERE id=?''', device.get('id'))
            cursor.close()
            db.commit()
            db.close()
        except Exception as e:
            self._logger.error("Error deleting device from database: %s" % e)

    def delete_location(self, location):
        try:
            db = sqlite3.connect(self.db_path)
            cursor = db.cursor()
            cursor.execute('''DELETE FROM locations WHERE id=?''', location.get('id'))
            cursor.close()
            db.commit()
            db.close()
        except Exception as e:
            self._logger.error("Error deleting location from database: %s" % e)

    def build_test_database(self):
        self.empty_database()
        self.create_database()
        try:
            self.insert_location({"name": "Enclosure (Internal)"})
            self.insert_location({"name": "Enclosure (External)"})
            self.insert_location({"name": "Office"})
            self.insert_device({
                "name": "Internal PM Sensor",
                "location_id": "1",
                "model": "PMSA003",
                "port": "COM3"
            })
            self.insert_device({
                "name": "External PM Sensor",
                "location_id": "2",
                "model": "PMSA003",
                "port": "COM4"
            })
        except Exception as e:
            self._logger.error("Error building test database: %s" % e)