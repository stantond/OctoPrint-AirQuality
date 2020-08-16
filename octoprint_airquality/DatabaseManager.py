import os
import sqlite3

class DatabaseManager():
    def __init__(self, plugin):
        self.db_path = os.path.join(plugin.get_plugin_data_folder(), "air_quality.db")
        self.create_database()

    def create_database(self):
        if not os.path.exists(self.db_path):
            db = sqlite3.connect(self.db_path)
            cursor = db.cursor()
            cursor.execute(
                '''CREATE TABLE devices(
                    id          INTEGER PRIMARY KEY,
                    created     TEXT,
                    modified    TEXT,
                    name        TEXT,
                    location    TEXT,
                    model       TEXT,
                    port        TEXT
                )''')
            cursor.execute(
                '''CREATE TABLE readings(
                    id          INTEGER PRIMARY KEY,
                    device_id
                    timestamp   TEXT,
                    pm1         REAL,
                    pm2_5       REAL
                    pm10        REAL,
                    n0_3,
                    n0_5,
                    n1_0,
                    n2_5,
                    n5_0,
                    n10_0,
                    FOREIGN KEY(device_id) REFERENCES devices(id)
                )''')
            db.commit()
            db.close()

    def delete_database(self):
        pass # @todo