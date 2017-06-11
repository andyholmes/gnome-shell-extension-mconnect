"use strict";

// Imports
const Lang = imports.lang;
const Signals = imports.signals;
const Main = imports.ui.main;
const Util = imports.misc.util;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { log, debug, assert, Settings } = Me.imports.prefs;


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


// Start the backend daemon
function startDaemon() {
    log("spawning kdeconnect daemon");
    
    try {
        // FIXME: not working
        //Util.spawnCommandLine("kdeconnectd");
        debug('not supported');
        GLib.usleep(10000); // 10ms
    } catch (e) {
        debug("kdeconnect.startDaemon: " + e);
    }
}


// Start the backend settings
function startSettings() {
    log("spawning kdeconnect settings");
    
    try {
        Util.spawnCommandLine("kcmshell5 kcm_kdeconnect");
        GLib.usleep(10000); // 10ms
    } catch (e) {
        debug("kdeconnect.startSettings: " + e);
    }
}


// A DBus Interface wrapper for the battery plugin
const Battery = new Lang.Class({
    Name: "Battery",
    
    _init: function (device) {
        debug("kdeconnect.Battery._init(" + device.busPath + ")");
        
        // Create proxy for the DBus Interface
        this.proxy = new BatteryProxy(
            Gio.DBus.session,
            BUS_NAME,
            device.busPath
        );
        
        // Properties
        this.device = device;
        
        Object.defineProperties(this, {
            charging: { get: this._isCharging },
            level: { get: this._charge }
        });
        
        // Signals
        this.proxy.connectSignal(
            "chargeChanged",
            Lang.bind(this, this._chargeChanged)
        );
        
        this.proxy.connectSignal(
            "stateChanged",
            Lang.bind(this, this._stateChanged)
        );
    },
    
    // KDE Connect Callbacks
    _chargeChanged: function (proxy, sender, level) {
        debug("kdeconnect.Battery._chargeChanged(): " + level[0]);
        
        // re-pack like an mconnect battery update
        let level_charging = [level[0], this.charging];
        // have the device re-emit the signal
        this.device.emit("changed::battery", null, level_charging);
    },
    
    _stateChanged: function (proxy, sender, charging) {
        debug("kdeconnect.Battery._stateChanged(): " + charging[0]);
        
        // re-pack like an mconnect battery update
        let level_charging = [this.level, charging[0]];
        // have the device re-emit the signal
        this.device.emit("changed::battery", null, level_charging);
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
        debug("kdeconnect.FindMyPhone._init(" + device.busPath + ")");
        
        // Create proxy for the DBus Interface
        this.proxy = new FindMyPhoneProxy(
            Gio.DBus.session,
            BUS_NAME,
            device.busPath + "/findmyphone"
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
        // FIXME: ...takes...a...while
        debug("kdeconnect.FindMyPhone.find()");
        
        this._ring();
    },
    
    destroy: function () {
        // TODO: disconnect signals
        delete this.proxy;
    }
});

Signals.addSignalMethods(Battery.prototype);

// Our supported plugins mapping
const Plugins = {
    "battery": Battery,
    "findmyphone": FindMyPhone
};


// A DBus Interface wrapper for a device
const Device = new Lang.Class({
    Name: "Device",
    
    _init: function (busPath) {
        // Create proxy for the DBus Interface
        this.proxy = new DeviceProxy(Gio.DBus.session, BUS_NAME, busPath);
        
        // Properties
        this.busPath = busPath;
        this.plugins = {};
        
        Object.defineProperties(this, {
            id: { value: this.busPath.substring(28) },
            name: { value: this.proxy.name },
            type: { value: this.proxy.type },
            version: { value: null }, // TODO: not a kdeconnect property
            address: { value: null }, // TODO: not a kdeconnect property
            paired: { value: true }, // FIXME: really fix me
            allowed: { value: this.proxy.isTrusted }, // TODO: this is actually changeable
            active: { value: this.proxy.isReachable },
            incomingCapabilities: { value: this.proxy.supportedPlugins },
            outgoingCapabilities: { get: this._loadedPlugins }
        });
        
        // Plugins
        this._pluginsChanged();
        
        // Signals
        this.proxy.connectSignal("nameChanged", Lang.bind(this, this._nameChanged));
        this.proxy.connectSignal("pairingError", Lang.bind(this, this._pairingError));
        this.proxy.connectSignal("pluginsChanged", Lang.bind(this, this._pluginsChanged));
        this.proxy.connectSignal("reachableStatusChanged", Lang.bind(this, this._reachableStatusChanged));
        this.proxy.connectSignal("trustedChanged", Lang.bind(this, this._trustedChanged));
    },
    
    // KDE Connect Callbacks
    _nameChanged: function (proxy, sender, name) {
        debug("kdeconnect.Device._nameChanged(): " + name[0]);
        
        this.emit("changed::name", null, name[0]);
    },
    
    _pairingError: function (proxy, sender, error) {
        debug("kdeconnect.Device._pairingError(): " + error[0]);
        
        this.emit("error::pairing", null, error[0]);
    },
    
    _pluginsChanged: function (proxy, sender) {
        debug("kdeconnect.Device._pluginsChanged()");
        
        for (let pluginName of this.outgoingCapabilities) {
            pluginName = pluginName.substring(11);
            
            if (Plugins.hasOwnProperty(pluginName)) {
                this.plugins[pluginName] = new Plugins[pluginName](this);
            }
        }
        
        this.emit("changed::plugins", null);
    },
    
    _reachableStatusChanged: function (proxy, sender) {
        debug("kdeconnect.Device._reachableStatusChanged()");
        
        this.emit("changed::active", null);
    },
    
    _trustedChanged: function (proxy, sender, trusted) {
        debug("kdeconnect.Device._trustedChanged(): " + trusted);
        
        this.emit("changed::trusted", null, trusted[0]);
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
        
        return this.proxy.isTrustedSync();
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
        
        // Add currently managed devices
        for (let deviceId of this._devices()) {
            this._deviceAdded(this, null, [deviceId]);
        }
        
        // Signals
        this.proxy.connectSignal("announcedNameChanged", Lang.bind(this, this._announcedNameChanged));
        this.proxy.connectSignal("deviceAdded", Lang.bind(this, this._deviceAdded));
        this.proxy.connectSignal("deviceRemoved", Lang.bind(this, this._deviceRemoved));
        this.proxy.connectSignal("deviceVisibilityChanged", Lang.bind(this, this._deviceVisibilityChanged));
    },
    
    // Callbacks
    _announcedNameChanged: function (proxy, sender, name) {
        // TODO
        debug("kdeconnect.DeviceManager._deviceAdded(): " + name[0]);
        
        this.emit("changed::name", null, name[0]);
    },
    
    _deviceAdded: function (proxy, sender, deviceId) {
        // deviceAdded returns a nested array, so that how we do it now
        debug("kdeconnect.DeviceManager._deviceAdded(" + deviceId[0] + ")");
        
        // KDE Connect organizes by device ID, we go by DBus path
        let busPath = "/modules/kdeconnect/devices/" + deviceId[0];
        
        this.devices[busPath] = new Device(busPath);
        this.emit("device::added", null, busPath);
    },
    
    _deviceRemoved: function (proxy, sender, deviceId) {
        // deviceRemoved returns a nested array, so that how we do it here too
        debug("kdeconnect.DeviceManager._deviceRemoved(" + deviceId[0] + ")");
        
        // KDE Connect organizes by device ID, we go by DBus path
        let busPath = "/modules/kdeconnect/devices/" + deviceId[0];
        
        this.devices[busPath].destroy();
        delete this.devices[busPath];
        this.emit("device::removed", null, busPath);
    },
    
    _deviceVisibilityChanged: function (proxy, sender, deviceId_visible) {
        // TODO: make deviceId->busPath
        debug("kdeconnect.DeviceManager._deviceVisibilityChanged(): " + deviceId_visible[0]);
        
        let deviceId = deviceId_visible[0][0];
        let visible = deviceId_visible[0][1];
        
        this.emit("device::visibility", null, [deviceId, visible]);
    },
    
    // Methods
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
        // FIXME: args
        // Returns a list of device id"s, optionally *onlyReachable*
        // or *onlyPaired*
        debug("kdeconnect.DeviceManager._devices()");
        
        return this.proxy.devicesSync();
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
    
    destroy: function () {
        for (let busPath in this.devices) {
            // _deviceRemoved takes a device id in an array (eg. [deviceId])
            this._deviceRemoved(this, null, [this.devices[busPath].id]);
        }
    }
});

Signals.addSignalMethods(DeviceManager.prototype);

