"use strict";

// Imports
const Lang = imports.lang;
const Signals = imports.signals;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

// Local Imports
function getPath() {
    // Diced from: https://github.com/optimisme/gjs-examples/
    let m = new RegExp("@(.+):\\d+").exec((new Error()).stack.split("\n")[1]);
    return Gio.File.new_for_path(m[1]).get_parent().get_path();
}

imports.searchPath.push(getPath());
const { debug, Settings } = imports.utils;


// DBus Constants
const BUS_NAME = "org.kde.kdeconnect";

const ManagerProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.kde.kdeconnect.daemon"> \
    <property name="isDiscoveringDevices" type="b" access="read"/> \
    <signal name="deviceAdded"> \
      <arg name="id" type="s" direction="out"/> \
    </signal> \
    <signal name="deviceRemoved"> \
      <arg name="id" type="s" direction="out"/> \
    </signal> \
    <signal name="deviceVisibilityChanged"> \
      <arg name="id" type="s" direction="out"/> \
      <arg name="isVisible" type="b" direction="out"/> \
    </signal> \
    <signal name="announcedNameChanged"> \
      <arg name="announcedName" type="s" direction="out"/> \
    </signal> \
    <method name="acquireDiscoveryMode"> \
      <arg name="id" type="s" direction="in"/> \
    </method> \
    <method name="releaseDiscoveryMode"> \
      <arg name="id" type="s" direction="in"/> \
    </method> \
    <method name="forceOnNetworkChange"> \
    </method> \
    <method name="announcedName"> \
      <arg type="s" direction="out"/> \
    </method> \
    <method name="setAnnouncedName"> \
      <arg name="name" type="s" direction="in"/> \
    </method> \
    <method name="devices"> \
      <arg type="as" direction="out"/> \
      <arg name="onlyReachable" type="b" direction="in"/> \
      <arg name="onlyPaired" type="b" direction="in"/> \
    </method> \
    <method name="devices"> \
      <arg type="as" direction="out"/> \
      <arg name="onlyReachable" type="b" direction="in"/> \
    </method> \
    <method name="devices"> \
      <arg type="as" direction="out"/> \
    </method> \
    <method name="deviceIdByName"> \
      <arg type="s" direction="out"/> \
      <arg name="name" type="s" direction="in"/> \
    </method> \
  </interface> \
</node> \
');

const DeviceProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.kde.kdeconnect.device"> \
    <property name="type" type="s" access="read"/> \
    <property name="name" type="s" access="read"/> \
    <property name="iconName" type="s" access="read"/> \
    <property name="statusIconName" type="s" access="read"/> \
    <property name="isReachable" type="b" access="read"/> \
    <property name="isTrusted" type="b" access="read"/> \
    <property name="supportedPlugins" type="as" access="read"/> \
    <signal name="pluginsChanged"> \
    </signal> \
    <signal name="reachableStatusChanged"> \
    </signal> \
    <signal name="trustedChanged"> \
      <arg name="trusted" type="b" direction="out"/> \
    </signal> \
    <signal name="pairingError"> \
      <arg name="error" type="s" direction="out"/> \
    </signal> \
    <signal name="nameChanged"> \
      <arg name="name" type="s" direction="out"/> \
    </signal> \
    <method name="requestPair"> \
    </method> \
    <method name="unpair"> \
    </method> \
    <method name="reloadPlugins"> \
    </method> \
    <method name="encryptionInfo"> \
      <arg type="s" direction="out"/> \
    </method> \
    <method name="isTrusted"> \
      <arg type="b" direction="out"/> \
    </method> \
    <method name="availableLinks"> \
      <arg type="as" direction="out"/> \
    </method> \
    <method name="loadedPlugins"> \
      <arg type="as" direction="out"/> \
    </method> \
    <method name="hasPlugin"> \
      <arg type="b" direction="out"/> \
      <arg name="name" type="s" direction="in"/> \
    </method> \
    <method name="pluginsConfigFile"> \
      <arg type="s" direction="out"/> \
    </method> \
  </interface> \
</node> \
');


// Plugins
const BatteryProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.kde.kdeconnect.device.battery"> \
    <signal name="stateChanged"> \
      <arg name="charging" type="b" direction="out"/> \
    </signal> \
    <signal name="chargeChanged"> \
      <arg name="charge" type="i" direction="out"/> \
    </signal> \
    <method name="charge"> \
      <arg type="i" direction="out"/> \
    </method> \
    <method name="isCharging"> \
      <arg type="b" direction="out"/> \
    </method> \
  </interface> \
</node> \
');

const FindMyPhoneProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.kde.kdeconnect.device.findmyphone"> \
    <method name="connected"> \
    </method> \
    <method name="ring"> \
    </method> \
  </interface> \
</node> \
');

const NotificationProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.kde.kdeconnect.device.notifications.notification"> \
    <property name="internalId" type="s" access="read"/> \
    <property name="appName" type="s" access="read"/> \
    <property name="ticker" type="s" access="read"/> \
    <property name="iconPath" type="s" access="read"/> \
    <property name="dismissable" type="b" access="read"/> \
    <method name="dismiss"> \
    </method> \
  </interface> \
</node> \
');

const NotificationsProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.kde.kdeconnect.device.notifications"> \
    <signal name="notificationPosted"> \
      <arg name="publicId" type="s" direction="out"/> \
    </signal> \
    <signal name="notificationRemoved"> \
      <arg name="publicId" type="s" direction="out"/> \
    </signal> \
    <signal name="allNotificationsRemoved"> \
    </signal> \
    <method name="activeNotifications"> \
      <arg type="as" direction="out"/> \
    </method> \
  </interface> \
</node> \
');

const TelephonyProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.kde.kdeconnect.device.telephony"> \
    <method name="sendSms"> \
      <arg name="phoneNumber" type="s" direction="in"/> \
      <arg name="messageBody" type="s" direction="in"/> \
    </method> \
  </interface> \
</node> \
');


// Start the backend daemon
function startDaemon() {
    debug("spawning kdeconnect daemon");
    
    try {
        // kdeconnectd isn't in PATH (at least on Ubuntu)
        let [res, out] = GLib.spawn_command_line_sync(
            "locate -br '^kdeconnectd$'"
        );
        
        // TODO: check this works, re:platform offscreen
        GLib.spawn_command_line_async(out.toString() + " -platform offscreen");
        GLib.usleep(10000); // 10ms
    } catch (e) {
        debug("kdeconnect.startDaemon: " + e);
    }
}


// Start the backend settings
function startSettings() {
    debug("spawning kdeconnect settings");
    
    try {
        GLib.spawn_command_line_async("kcmshell5 kcm_kdeconnect");
        GLib.usleep(10000); // 10ms
    } catch (e) {
        debug("kdeconnect.startSettings: " + e);
    }
}


// A DBus Interface wrapper for the battery plugin
const Battery = new Lang.Class({
    Name: "Battery",
    
    _init: function (device) {
        debug("kdeconnect.Battery._init(" + device.dbusPath + ")");
        
        // Create proxy for the DBus Interface
        this.proxy = new BatteryProxy(
            Gio.DBus.session,
            BUS_NAME,
            device.dbusPath
        );
        
        // Properties
        this.device = device;
        
        Object.defineProperties(this, {
            charging: { get: this._isCharging },
            level: { get: this._charge }
        });
        
        // KDE Connect Signals
        this.proxy.connectSignal("chargeChanged", (proxy, sender, level) => {
            debug("kdeconnect.Battery._chargeChanged(" + level[0] + ")");
            
            // re-pack like an mconnect battery update
            let levelCharging = [level[0], this.charging];
            // have the device re-emit the signal
            this.device.emit("changed::battery", levelCharging);
        });
        
        this.proxy.connectSignal("stateChanged", (proxy, sender, charging) => {
            debug("kdeconnect.Battery._stateChanged(" + charging[0] + ")");
            
            // re-pack like an mconnect battery update
            let levelCharging = [this.level, charging[0]];
            // have the device re-emit the signal
            this.device.emit("changed::battery", levelCharging);
        });
    },
    
    // KDE Connect Methods
    _charge: function () {
        // Returns an integer percentage of the device"s battery remaining
        debug("kdeconnect.Battery._charge()");
        
        return this.proxy.chargeSync();
    },
    
    _isCharging: function () {
        // Returns a boolean if device is charging
        debug("kdeconnect.Battery._isCharging()");
        
        return this.proxy.isChargingSync();
    },
    
    // Public Methods
    destroy: function () {
        // TODO: disconnect signals
        delete this.proxy;
    }
});

Signals.addSignalMethods(Battery.prototype);


// A DBus Interface wrapper for the findmyphone plugin
const FindMyPhone = new Lang.Class({
    Name: "FindMyPhone",
    
    _init: function (device) {
        debug("kdeconnect.FindMyPhone._init(" + device.dbusPath + ")");
        
        // Create proxy for the DBus Interface
        this.proxy = new FindMyPhoneProxy(
            Gio.DBus.session,
            BUS_NAME,
            device.dbusPath + "/findmyphone"
        );
        
        // Properties
        this.device = device;
    },
    
    // KDE Connect Methods
    _connected: function () {
        // TODO: figure out what this does
        debug("kdeconnect.FindMyPhone._connected()");
        
        this.proxy.connectedSync();
    },
    
    _ring: function () {
        debug("kdeconnect.FindMyPhone._ring()");
        
        this.proxy.ringSync();
    },
    
    // Public Methods
    find: function () {
        // TODO: ...takes...a...while, async?
        debug("kdeconnect.FindMyPhone.find()");
        
        this._ring();
    },
    
    destroy: function () {
        delete this.proxy;
    }
});

Signals.addSignalMethods(FindMyPhone.prototype);


// A DBus Interface wrapper for the notifications plugin
// FIXME: gnome-shell freaks if you use "Notifications"
const Notificationz = new Lang.Class({
    Name: "Notificationz",
    
    _init: function (device) {
        debug("kdeconnect.Notifications._init(" + device.dbusPath + ")");
        
        // Create proxy for the DBus Interface
        this.proxy = new NotificationsProxy(
            Gio.DBus.session,
            BUS_NAME,
            device.dbusPath
        );
        
        // Properties
        this.device = device;
        
        Object.defineProperties(this, {
            notifications: { get: this._activeNotifications }
        });
        
        // Signals
        this.proxy.connectSignal("allNotificationsRemoved", (proxy, sender) => {
            debug("kdeconnect.Notifications._allNotificationsRemoved()");
            
            // have the device re-emit the signal
            this.device.emit("notification::dismissed-all", null);
        });
        
        this.proxy.connectSignal("notificationPosted", (proxy, sender, dbusPath) => {
            debug("kdeconnect.Notifications._notificationPosted(" + dbusPath[0] + ")");
            
            // have the device re-emit the signal
            this.device.emit("notification::received", null, dbusPath[0]);
        });
        
        this.proxy.connectSignal("notificationRemoved", (proxy, sender, dbusPath) => {
            debug("kdeconnect.Notifications._notificationRemoved(" + dbusPath[0] + ")");
            
            // have the device re-emit the signal
            this.device.emit("notification::dismissed", null, dbusPath[0]);
        });
    },
    
    // KDE Connect Methods
    _activeNotifications: function () {
        debug("kdeconnect.Notifications._activeNotifications()");
        
        return this.proxy.activeNotificationsSync()[0];
    },
    
    // Public Methods
    destroy: function () {
        // TODO: disconnect signals
        delete this.proxy;
    }
});

Signals.addSignalMethods(Notificationz.prototype);


// A DBus Interface wrapper for the telephony plugin
const Telephony = new Lang.Class({
    Name: "Telephony",
    
    _init: function (device) {
        debug("kdeconnect.Telephony._init(" + device.dbusPath + ")");
        
        // Create proxy for the DBus Interface
        this.proxy = new TelephonyProxy(
            Gio.DBus.session,
            BUS_NAME,
            device.dbusPath + "/telephony"
        );
        
        // Properties
        this.device = device;
    },
    
    // KDE Connect Methods
    _sendSms: function (phoneNumber, messageBody) {
        debug("kdeconnect.Telephony._sendSms(" + messageBody + ")");
        
        this.proxy.sendSmsSync(phoneNumber, messageBody);
    },
    
    // Public Methods
    send: function (number, message) {
        debug("kdeconnect.Telephony.send(" + message + ")");
        
        this._sendSms(number, message);
    },
    
    destroy: function () {
        delete this.proxy;
    }
});

Signals.addSignalMethods(Telephony.prototype);

// Our supported plugins mapping
const Plugins = {
    "battery": Battery,
    "findmyphone": FindMyPhone,
    // FIXME: gnome-shell freaks if you use "Notifications"
    "notifications": Notificationz,
    "telephony": Telephony
};


// A DBus Interface wrapper for a device
const Device = new Lang.Class({
    Name: "Device",
    
    _init: function (dbusPath) {
        // Create proxy for the DBus Interface
        this.proxy = new DeviceProxy(Gio.DBus.session, BUS_NAME, dbusPath);
        
        // Properties
        this.dbusPath = dbusPath;
        this.plugins = {};
        
        Object.defineProperties(this, {
            id: { value: this.dbusPath.substring(28) },
            name: { value: this.proxy.name },
            type: { value: this.proxy.type },
            trusted: {
                get: this._isTrusted,
                set: (trusted) => { (trusted) ? this._requestPair() : this._pair(); }
            },
            active: { value: this.proxy.isReachable },
            // TODO: still not clear on these two
            incomingCapabilities: { value: this.proxy.supportedPlugins },
            outgoingCapabilities: { get: this._loadedPlugins }
        });
        
        // Signals
        this.proxy.connectSignal("nameChanged", (proxy, sender, name) => {
            debug("kdeconnect.Device::nameChanged: " + name[0]);
            
            this.emit("changed::name", name[0]);
        });
        
        this.proxy.connectSignal("pairingError", (proxy, sender, error) => {
            debug("kdeconnect.Device::pairingError: " + error[0]);
            
            this.emit("error::pairing", error[0]);
        });
        
        this.proxy.connectSignal("pluginsChanged", (proxy, sender) => {
            debug("kdeconnect.Device::pluginsChanged");
            
            for (let pluginName of this.outgoingCapabilities) {
                pluginName = pluginName.substring(11);
                
                if (Plugins.hasOwnProperty(pluginName)) {
                    this.plugins[pluginName] = new Plugins[pluginName](this);
                }
            }
            
            this.emit("changed::plugins", null);
        });
        
        this.proxy.connectSignal("reachableStatusChanged", (proxy, sender) => {
            debug("kdeconnect.Device::reachableStatusChanged");
            
            this.emit("changed::active", this.active);
        });
        
        this.proxy.connectSignal("trustedChanged", (proxy, sender, trusted) => {
            debug("kdeconnect.Device::trustedChanged:" + trusted[0]);
            
            this.emit("changed::trusted", trusted[0]);
        });
            
        for (let pluginName of this.outgoingCapabilities) {
            pluginName = pluginName.substring(11);
            
            if (Plugins.hasOwnProperty(pluginName)) {
                this.plugins[pluginName] = new Plugins[pluginName](this);
            }
        }
    },
    
    // KDE Connect Methods
    _availableLinks: function () {
        // Returns a list of "Link Providers" (whatever that is)
        debug("kdeconnect.Device._availableLinks()");
        
        return this.proxy.availableLinksSync()[0]; // TODO ?
    },
    
    _encryptionInfo: function () {
        // Return a string of formatted encryption info
        // TODO: might not be a plain string, in an array or something
        debug("kdeconnect.Device._connected()");
        
        return this.proxy.encryptionInfoSync();
    },
    
    _hasPlugin: function (name) {
        // Takes string *name*, return boolean if device has plugin
        // (eg. kdeconnect_telephony)
        debug("kdeconnect.Device._hasPlugin(" + name + ")");
        
        return this.proxy.hasPluginSync(name);
    },
    
    _isTrusted: function () {
        // Return boolean whether the device is trusted (paired?)
        debug("kdeconnect.Device._isTrusted()");
        
        return this.proxy.isTrustedSync()[0];
    },
    
    _loadedPlugins: function () {
        // Return a list of the device's loaded plugins
        // NOTE: returns an array in an array, sneaky
        debug("kdeconnect.Device._loadedPlugins()");
        
        return this.proxy.loadedPluginsSync()[0];
    },
    
    _pluginsConfigFile: function () {
        // Return a string pathname to this device's plugins configuration
        debug("kdeconnect.Device._pluginsFile()");
        
        return this.proxy.pluginsConfigFileSync();
    },
    
    _reloadPlugins: function () {
        // Reload device's plugins (why?)
        debug("kdeconnect.Device._reloadPlugins()");
        
        return this.proxy.reloadPluginsSync();
    },
    
    _requestPair: function () {
        // Request pairing with device
        debug("kdeconnect.Device._requestPair()");
        
        return this.proxy.requestPairSync();
    },
    
    _unpair: function () {
        // Unpair (untrust?) this device
        debug("kdeconnect.Device._unpair()");
        
        return this.proxy.unpairSync();
    },
    
    // Public Methods
    destroy: function () {
        for (let pluginName in this.plugins) {
            this.plugins[pluginName].destroy();
            delete this.plugins[pluginName];
        }
        
        delete this.proxy;
    }
});

Signals.addSignalMethods(Device.prototype);


// A DBus Interface wrapper for a device manager
const DeviceManager = new Lang.Class({
    Name: "DeviceManager",
    
    devices: {},
    
    _init: function () {
        // Create proxy wrapper for DBus Interface
        this.proxy = new ManagerProxy(
            Gio.DBus.session,
            BUS_NAME,
            "/modules/kdeconnect"
        );
        
        // Properties
        Object.defineProperties(this, {
            name: { get: this._announcedName, set: this._setAnnouncedName }
        });
        
        // Signals
        this.proxy.connectSignal("announcedNameChanged", (proxy, sender, name) => {
            // TODO
            this.emit("changed::name", null, name[0]);
        });
        
        this.proxy.connectSignal("deviceAdded", (proxy, sender, deviceId) => {
            // KDE Connect organizes by device ID, we go by DBus path
            let dbusPath = "/modules/kdeconnect/devices/" + deviceId[0];
            
            this.devices[dbusPath] = new Device(dbusPath);
            this.emit("device::added", null, dbusPath);
        });
        
        this.proxy.connectSignal("deviceRemoved", (proxy, sender, deviceId) => {
            // KDE Connect organizes by device ID, we go by DBus path
            let dbusPath = "/modules/kdeconnect/devices/" + deviceId[0];
            
            this.devices[dbusPath].destroy();
            delete this.devices[dbusPath];
            this.emit("device::removed", null, dbusPath);
        });
        
        this.proxy.connectSignal("deviceVisibilityChanged", (proxy, sender, deviceId_visible) => {
            let deviceId = deviceId_visible[0];
            let visible = deviceId_visible[1];
            
            // We're going to have to device emit this signal for now
            let device = this.devices["/modules/kdeconnect/devices/" + deviceId];
            device.emit("changed::active", visible);
        });
        
        // Add currently managed devices
        for (let deviceId of this._devices()) {
            // KDE Connect organizes by device ID, we go by DBus path
            let dbusPath = "/modules/kdeconnect/devices/" + deviceId;
            
            this.devices[dbusPath] = new Device(dbusPath);
            this.emit("device::added", null, dbusPath);
        }
    },
    
    // KDE Connect Methods
    _acquireDiscoveryMode: function (id) {
        // Send a pairing request to *id*
        debug("kdeconnect.DeviceManager._acquireDiscoveryMode(" + id + ")");
        
        return this.proxy.acquireDiscoveryModeSync(id);
    },
    
    _announcedName: function () {
        // Return a string name of the Device Manager
        debug("kdeconnect.DeviceManager._announcedName()");
        
        return this.proxy.announcedNameSync();
    },
    
    _deviceIdByName: function (name) {
        // Takes a string *name*; Returns a string *id*
        debug("kdeconnect.DeviceManager._deviceIdByName(" + name + ")");
        
        return this.proxy.deviceIdByNameSync(name);
    },
    
    _devices: function (onlyReachable = false, onlyPaired = false) {
        // TODO: args
        // Returns a nested list of device id's, optionally *onlyReachable*
        // or *onlyPaired*
        debug("kdeconnect.DeviceManager._devices()");
        
        return this.proxy.devicesSync()[0];
    },
    
    _forceOnNetworkChange: function () {
        debug("kdeconnect.DeviceManager._forceOnNetworkChange()");
        
        return this.proxy.forceOnNetworkChangeSync();
    },
    
    _releaseDiscoveryMode: function (id) {
        // Release the device with *id* from discovery (?)
        debug("kdeconnect.DeviceManager._releaseDiscoveryMode()");
        
        return this.proxy.releaseDiscoveryModeSync(id);
    },
    
    _setAnnouncedName: function (name) {
        // Sets the Device Manager's name to the string *name*
        debug("kdeconnect.DeviceManager._setAnnouncedName()");
        
        return this.proxy.setAnnouncedNameSync(name);
    },
    
    // Public Methods
    trustDevice: function (dbusPath) {
        // We're going to do it the MConnect way with dbusPath's
        debug("kdeconnect.DeviceManager.trustDevice()");
        
        this.devices[dbusPath]._requestPair();
    },
    
    untrustDevice: function (dbusPath) {
        // We're going to do it the MConnect way with dbusPath's
        debug("kdeconnect.DeviceManager.trustDevice()");
        
        this.devices[dbusPath]._unpair();
    },
    
    destroy: function () {
        for (let dbusPath in this.devices) {
            this.devices[dbusPath].destroy();
            delete this.devices[dbusPath];
            this.emit("device::removed", null, dbusPath);
        }
    }
});

Signals.addSignalMethods(DeviceManager.prototype);

