/*
 * View model for OctoPrint-AirQuality
 *
 * Author: Daniel Stanton
 * License: AGPLv3
 */
$(function() {
    function AirQualityViewModel(parameters) {
        var self = this;

        self.settings = parameters[0];
        self.arrDevices = ko.observableArray();
        self.selectedDevice = ko.observable();

        self.onBeforeBinding = function() {
            self.arrDevices(self.settings.settings.plugins.airquality.arrDevices());
        }

        self.onAfterBinding = function() {
            // TODO handle missing devices
        }

        // self.onSettingsBeforeSave = function(payload) {
        //     var devices_updated = (ko.toJSON(self.arrDevices()) !== ko.toJSON(self.settings.settings.plugins.airquality.arrDevices()));
        //     self.arrDevices(self.settings.settings.plugins.airquality.arrDevices());
        //     if(devices_updated){
        //         // TODO reload devices
        //     }
        // }

        self.addDevice = function() {
            self.selectedDevice({
                'name':ko.observable(''),
                'model':ko.observable(''),
                'location':ko.observable(''),
                'port':ko.observable('')
            });
            self.settings.settings.plugins.airquality.arrDevices.push(self.selectedDevice());
            $("#AirQualityDeviceEditor").modal("show");
        }

        self.editDevice = function(data) {
            self.selectedDevice(data);
            $("#AirQualityDeviceEditor").modal("show");
        }

        self.removeDevice = function(row) {
            self.settings.settings.plugins.airquality.arrDevices.remove(row);
        }
    }


    OCTOPRINT_VIEWMODELS.push({
        construct: AirQualityViewModel,
        dependencies: ["settingsViewModel"],
        elements: ["#settings_plugin_airquality"]
    });
});
