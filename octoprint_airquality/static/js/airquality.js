/*
 * View model for OctoPrint-AirQuality
 *
 * Author: Daniel Stanton
 * License: AGPLv3
 */
$(function() {
    function AirQualityViewModel(parameters) {
        var self = this;

        // self.supportedDevices = {
        //     "5003": "Plantower PMS5003",
        //     "7003": "Plantower PMS7003",
        //     "A003": "Plantower PMSA003"
        // };

        self.supportedDevices = {
            "PMS1003": "Plantower PMS1003 (aka G1)",
            "PMS3003": "Plantower PMS3003 (aka G3)",
            "PMS5003": "Plantower PMS5003 (aka G5)",
            "PMS5003S": "Plantower PMS5003S",
            "PMS5003ST": "Plantower PMS5003ST",
            "PMS5003T": "Plantower PMS5003T",
            "PMS7003": "Plantower PMS7003 (aka G7)",
            "PMSA003": "Plantower PMSA003 (aka G10)",
            "SDS011": "Nova SDS011",
            "SDS018": "Nova SDS018",
            "SDS021": "Nova SDS021",
            "SDS198": "Nova SDS198",
            "HPMA115S0": "Honeywell HPMA115S0",
            "HPMA115C0": "Honeywell HPMA115C0",
            "SPS30": "Senserion SPS30"
        };

        self.settings = parameters[0];

        self.devices = ko.observableArray();
        self.locations = ko.observableArray();

        self.serialPorts = {};
        self.serialPortsList = ko.observableArray();
        self.selectedDevice = ko.observable();
        self.selectedLocation = ko.observable();
        self.recentChanges = ko.observable(false);
        self.sensorReadThreadRunning = ko.observable(false);

        /* Used by the Edit template to show a warning when the selected port is unavailable */
        self.isPortAvailable = ko.computed(function() {
            if (self.selectedDevice() !== undefined) {
                if (self.serialPortsList.indexOf(self.selectedDevice().port()) == -1 && self.selectedDevice().port() !== undefined) {
                    return false;
                } else {
                    return true;
                };
            };
        });

        /* Provides a list of serial ports for the user to choose from during device edit,
        including the currently set port even if it's not plugged in, and
        excluding ports already in use by this plugin for other devices */
        self.serialPortsListEdit = ko.computed(function() {
            var fullList = [];
            fullList.push(...self.serialPortsList());
            ko.utils.arrayForEach(self.devices(), function(device) {
                if (device.port() !== null && device.port() !== undefined){
                    var index = fullList.indexOf(device.port());
                    if (index > -1) {
                        fullList.splice(index, 1);
                      }
                }
            });
            if (self.selectedDevice() !== undefined) {
                if (fullList.indexOf(self.selectedDevice().port()) == -1 && self.selectedDevice().port() !== undefined) {
                    fullList.push(ko.toJS(self.selectedDevice().port()));
                };
            };
            return fullList;
        });

        self.models = ko.observableArray(mapDictionaryToArray(self.supportedDevices));

        self.alertMessage = ko.observable("");
        self.alertType = ko.observable("alert-warning");
        self.showAlert = ko.observable(false);

        self.alertControlsMessage = ko.observable("");
        self.alertControlsType = ko.observable("alert-warning");
        self.alertControlsShow = ko.observable(false);

        self.getPrettyModel = function(model) {
            return self.supportedDevices[model];
        }

        self.getLocationNamefromId = function(lookupId) {
            found_location = ko.utils.arrayFirst(self.locations(), function(location) {
                return lookupId == location.id();
            });
            if (found_location) { return found_location.name() };
        }

        /* First load of device and location settings from the database */
        self.onBeforeBinding = function() {
            self.requestSerialPortsMessage();
            self.loadLocationsFromDatabase();
            self.loadDevicesFromDatabase();
        }

        self.onAfterBinding = function() {
            // TODO handle missing devices?
        }

        /* Silently ask the backend to check for available sensors when the settings screen is shown.
        The actual dictionary of updated sensors comes back using the Plugin Message mechanism*/
        self.requestSerialPortsMessage = function() {
            $.ajax({
                url: API_BASEURL + "plugin/airquality",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "refresh_available_serial_ports"
                }),
                contentType: "application/json; charset=UTF-8"
            });
        }

        self.onDataUpdaterPluginMessage = function(pluginName, message) {
            if (pluginName != "airquality") {
                // Ignore messages for other plugins
				return;
            }
            if (message.serial_ports) {
                // Store the updated dictionary of serial ports
                self.serialPorts = message.serial_ports;
                self.serialPortsList(Object.keys(self.serialPorts));
            }
            if (message.sensors_read_thread_active_status) {
                // Update the status of the Sensor Read Thread
                self.sensorReadThreadRunning(JSON.parse(message.sensors_read_thread_active_status));
            }
        }

        self.hideAlert = function() {
            self.showAlert(false);
        }

        self.alertControlsHide = function() {
            self.alertControlsShow(false);
        }

        /* User can manually the backend to check for available serial ports. The actual
        dictionary of updated serial ports comes back using the Plugin Message mechanism.
        Disables the button until the flash message has cleared. */
        self.refreshAvailableSerialPorts = function(button=null) {
            var alert = undefined;
            button.disabled=true;
            $.ajax({
                url: API_BASEURL + "plugin/airquality",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "refresh_available_serial_ports"
                }),
                contentType: "application/json; charset=UTF-8",
                success: function(response) {
                    if(button!==null) {
                        alertText = gettext(response["message"]);
                        self.alertType("alert-success");
                        self.alertMessage(alertText);
                        self.showAlert(true);
                        setTimeout(function() {
                            self.showAlert(false);
                        }, 3000);
                        setTimeout(function() {
                            button.disabled=false;
                        }, 3000);
                    }
                },
                error: function(response, errorThrown) {
                    if(button!==null) {
                        alert = gettext(response["message"] + ": " + errorThrown);
                        self.alertType("alert-error");
                        self.alertMessage(alertText);
                        self.showAlert(true);
                        setTimeout(function() {
                            button.disabled=false;
                        }, 3000);
                    }
                }
            })
        }

        /* User can manually start the Sensor Read Thread. */
        self.startSensorRead = function(button=null) {
            var alert = undefined;
            button.disabled=true;
            $.ajax({
                url: API_BASEURL + "plugin/airquality",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "start_sensor_read"
                }),
                contentType: "application/json; charset=UTF-8",
                success: function(response) {
                    if(button!==null) {
                        alertText = gettext(response["message"]);
                        self.alertControlsType("alert-success");
                        self.alertControlsMessage(alertText);
                        self.alertControlsShow(true);
                        setTimeout(function() {
                            self.alertControlsShow(false);
                        }, 3000);
                    }
                },
                error: function(response, errorThrown) {
                    if(button!==null) {
                        alert = gettext(response["message"] + ": " + errorThrown);
                        self.alertControlsType("alert-error");
                        self.alertControlsMessage(alertText);
                        self.alertControlsShow(true);
                    }
                }
            })
        }

        /* User can manually stop the Sensor Read Thread. */
        self.stopSensorRead = function(button=null) {
            var alert = undefined;
            button.disabled=true;
            $.ajax({
                url: API_BASEURL + "plugin/airquality",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "stop_sensor_read"
                }),
                contentType: "application/json; charset=UTF-8",
                success: function(response) {
                    if(button!==null) {
                        alertText = gettext(response["message"]);
                        self.alertControlsType("alert-success");
                        self.alertControlsMessage(alertText);
                        self.alertControlsShow(true);
                        setTimeout(function() {
                            self.alertControlsShow(false);
                        }, 3000);
                    }
                },
                error: function(response, errorThrown) {
                    if(button!==null) {
                        alert = gettext(response["message"] + ": " + errorThrown);
                        self.alertControlsType("alert-error");
                        self.alertControlsMessage(alertText);
                        self.alertControlsShow(true);
                    }
                }
            })
        }

        self.onSettingsShown = function() {
            self.requestSerialPortsMessage();
        }

        /* Restarts the sensor reading thread, applying any device and location changes, and hides the Recent Changes message */
        self.onSettingsBeforeSave = function(payload) {
            self.recentChanges(false);
            // @TODO restart the sensor thread to apply the new changes
        }

        /* Get locations from the database and iteratively push each location into the local locations array with observable attributes*/
        self.loadLocationsFromDatabase = function() {
            $.ajax({
                url: API_BASEURL + "plugin/airquality",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "get_locations"
                }),
                contentType: "application/json; charset=UTF-8",
                success: function(response) {
                    self.locations([]);
                    response["locations"].forEach(function(location){
                        location = {
                            'id':ko.observable(location.id),
                            'name':ko.observable(location.name)
                        };
                        self.locations.push(location);
                    });
                },
                error: function(response, errorThrown) {
                    console.log(gettext(response["message"] + ": " + errorThrown));
                }
            });
        }

        /* Get devices from the database and iteratively push each device into the local locations array with observable attributes*/
        self.loadDevicesFromDatabase = function() {
            $.ajax({
                url: API_BASEURL + "plugin/airquality",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "get_devices"
                }),
                contentType: "application/json; charset=UTF-8",
                success: function(response) {
                    self.devices([]);
                    response["devices"].forEach(function(device){
                        device = {
                            'id':ko.observable(device.id),
                            'location_id':ko.observable(device.location_id),
                            'model':ko.observable(device.model),
                            'name':ko.observable(device.name),
                            'port':ko.observable(device.port),
                        };
                        device.portAvailable = ko.computed(function() {
                            if (self.serialPortsList.indexOf(device.port()) == -1 && device.port() !== undefined) {
                                return false;
                            } else {
                                return true;
                            };
                        })
                        self.devices.push(device);
                    });
                },
                error: function(response, errorThrown) {
                    console.log(gettext(response["message"] + ": " + errorThrown));
                }
            });
        }

        /* Shows the Create Device modal. Provide an empty set of observables for Create Device functionality */
        self.showCreateDeviceModal = function() {
            self.selectedDevice({
                'location_id':ko.observable(''),
                'model':ko.observable(''),
                'name':ko.observable(''),
                'port':ko.observable('')
            });
            $("#AirQualityDeviceCreateModal").modal("show");
        }

        /* Shows the Create Location modal. Provide an empty set of observables for Create Location functionality */
        self.showCreateLocationModal = function() {
            self.selectedLocation({
                'name':ko.observable('')
            });
            $("#AirQualityLocationCreateModal").modal("show");
        }

        /* Create the new device in the database. Reloads devices from database if successful*/
        self.createDevice = function() {
            $.ajax({
                url: API_BASEURL + "plugin/airquality",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "create_device",
                    device: ko.toJS(self.selectedDevice())
                }),
                contentType: "application/json; charset=UTF-8",
                success: function(response) {
                    $("#AirQualityDeviceCreateModal").modal("hide");
                    self.recentChanges(true);
                    self.loadDevicesFromDatabase();
                },
                error: function(response, errorThrown) {
                    console.log(gettext(response["message"] + ": " + errorThrown));
                }
            });
        }

        /* Create the new location in the database. Reloads locations from database if successful*/
        self.createLocation = function() {
            $.ajax({
                url: API_BASEURL + "plugin/airquality",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "create_location",
                    location: ko.toJS(self.selectedLocation())
                }),
                contentType: "application/json; charset=UTF-8",
                success: function(response) {
                    $("#AirQualityLocationCreateModal").modal("hide");
                    self.recentChanges(true);
                    self.loadLocationsFromDatabase();
                },
                error: function(response, errorThrown) {
                    console.log(gettext(response["message"] + ": " + errorThrown));
                }
            });
        }

        /* Shows the Edit Device modal. Creates a copy of the device to manipulate to prevent the devices
        table updating at the same time. */
        self.showEditDeviceModal = function(device) {
            nonObservableDevice = ko.toJS(device);
            self.selectedDevice({
                'id':ko.observable(nonObservableDevice["id"]),
                'location_id':ko.observable(nonObservableDevice["location_id"]),
                'model':ko.observable(nonObservableDevice["model"]),
                'name':ko.observable(nonObservableDevice["name"]),
                'port':ko.observable(nonObservableDevice["port"])
            });
            $("#AirQualityDeviceEditModal").modal("show");
        }

        /* Shows the Edit Location modal. Creates a copy of the location to manipulate to prevent the locations
        table updating at the same time. */
        self.showEditLocationModal = function(location) {
            nonObservableLocation = ko.toJS(location);
            self.selectedLocation({
                'id':ko.observable(nonObservableLocation["id"]),
                'name':ko.observable(nonObservableLocation["name"])
            });
            $("#AirQualityLocationEditModal").modal("show");
        }

        /* Update the device in the database. Reloads devices from database if successful*/
        self.editDevice = function(device) {
            $.ajax({
                url: API_BASEURL + "plugin/airquality",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "update_device",
                    device: ko.toJS(self.selectedDevice())
                }),
                contentType: "application/json; charset=UTF-8",
                success: function(response) {
                    $("#AirQualityDeviceEditModal").modal("hide");
                    self.recentChanges(true);
                    self.loadDevicesFromDatabase();
                },
                error: function(response, errorThrown) {
                    console.log(gettext(response["message"] + ": " + errorThrown));
                }
            });
        }

        /* Update the location in the database. Reloads locations from database if successful*/
        self.editLocation = function(location) {
            $.ajax({
                url: API_BASEURL + "plugin/airquality",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "update_location",
                    location: ko.toJS(self.selectedLocation())
                }),
                contentType: "application/json; charset=UTF-8",
                success: function(response) {
                    $("#AirQualityLocationEditModal").modal("hide");
                    self.recentChanges(true);
                    self.loadLocationsFromDatabase();
                },
                error: function(response, errorThrown) {
                    console.log(gettext(response["message"] + ": " + errorThrown));
                }
            });
        }

        /* Shows the Delete Device confirmation modal. */
        self.showDeleteDeviceModal = function(device) {
            self.selectedDevice(device);
            $("#AirQualityDeviceDeleteModal").modal("show");
        }

        /* Shows the Delete Location confirmation modal. */
        self.showDeleteLocationModal = function(location) {
            self.selectedLocation(location);
            $("#AirQualityLocationDeleteModal").modal("show");
        }

        /* Deletes the device from the database. Reloads devices from database if successful*/
        self.deleteDevice = function(device) {
            $.ajax({
                url: API_BASEURL + "plugin/airquality",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "delete_device",
                    device: {
                        "id": ko.toJSON(device.id())
                    }
                }),
                contentType: "application/json; charset=UTF-8",
                success: function(response) {
                    $("#AirQualityDeviceDeleteModal").modal("hide");
                    self.recentChanges(true);
                    self.loadDevicesFromDatabase();
                },
                error: function(response, errorThrown) {
                    console.log(gettext(response["message"] + ": " + errorThrown));
                }
            });
        }

        /* Deletes the location from the database. Reloads locations from database if successful*/
        self.deleteLocation = function(location) {
            $.ajax({
                url: API_BASEURL + "plugin/airquality",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "delete_location",
                    location: {
                        "id": ko.toJSON(location.id())
                    }
                }),
                contentType: "application/json; charset=UTF-8",
                success: function(response) {
                    $("#AirQualityLocationDeleteModal").modal("hide");
                    self.recentChanges(true);
                    self.loadLocationsFromDatabase();
                },
                error: function(response, errorThrown) {
                    console.log(gettext(response["message"] + ": " + errorThrown));
                }
            });
        }
    }

    /* Utility function to make dictionaries into an array that a ko.observable can use */
    function mapDictionaryToArray(dictionary) {
        var result = [];
        for (var key in dictionary) {
            if (dictionary.hasOwnProperty(key)) {
                result.push({ key: key, value: dictionary[key] });
            }
        }
        return result;
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: AirQualityViewModel,
        dependencies: ["settingsViewModel"],
        elements: ["#settings_plugin_airquality"]
    });
});
