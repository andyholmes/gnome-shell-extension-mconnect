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
const BUS_NAME = "org.mconnect";

const PropertiesProxy = Gio.DBusProxy.makeProxyWrapper('\
<node> \
  <interface name="org.freedesktop.DBus.Properties"> \
    <method name="Get"> \
      <arg type="s" name="interface_name" direction="in"/> \
      <arg type="s" name="property_name" direction="in"/> \
      <arg type="v" name="value" direction="out"/> \
    </method> \
    <method name="GetAll"> \
      <arg type="s" name="interface_name" direction="in"/> \
      <arg type="a{sv}" name="properties" direction="out"/> \
    </method> \
    <method name="Set"> \
      <arg type="s" name="interface_name" direction="in"/> \
      <arg type="s" name="property_name" direction="in"/> \
      <arg type="v" name="value" direction="in"/> \
    </method> \
    <signal name="PropertiesChanged"> \
      <arg type="s" name="interface_name"/> \
      <arg type="a{sv}" name="changed_properties"/> \
      <arg type="as" name="invalidated_properties"/> \
    </signal> \
  </interface> \
</node> \
');


const DeviceNode = new Gio.DBusNodeInfo.new_for_xml('\
<node> \
  <interface name="org.mconnect.Device"> \
    <property type="s" name="Id" access="readwrite"/> \
    <property type="s" name="Name" access="readwrite"/> \
    <property type="s" name="DeviceType" access="readwrite"/> \
    <property type="u" name="ProtocolVersion" access="readwrite"/> \
    <property type="s" name="Address" access="readwrite"/> \
    <property type="b" name="IsPaired" access="readwrite"/> \
    <property type="b" name="Allowed" access="readwrite"/> \
    <property type="b" name="IsActive" access="readwrite"/> \
    <property type="b" name="IsConnected" access="readwrite"/> \
    <property type="as" name="IncomingCapabilities" access="readwrite"/> \
    <property type="as" name="OutgoingCapabilities" access="readwrite"/> \
  </interface> \
  <interface name="org.mconnect.Device.Battery"> \
    <property type="u" name="Level" access="readwrite"/> \
    <property type="b" name="Charging" access="readwrite"/> \
  </interface> \
  <interface name="org.mconnect.Device.Ping"> \
    <signal name="Ping"> \
    </signal> \
  </interface> \
</node> \
');


const ManagerNode = new Gio.DBusNodeInfo.new_for_xml('\
<node> \
  <interface name="org.mconnect.DeviceManager"> \
    <method name="AllowDevice"> \
      <arg type="s" name="path" direction="in"/> \
    </method> \
    <method name="ListDevices"> \
      <arg type="ao" name="result" direction="out"/> \
    </method> \
  </interface> \
</node> \
');


const Interface = {
    DEVICE: DeviceNode.interfaces[0],
    BATTERY: DeviceNode.interfaces[1],
    PING: DeviceNode.interfaces[2],
    MANAGER: ManagerNode.interfaces[0]
};


// Start the backend daemon
function startDaemon() {
    debug("spawning mconnect daemon");
    
    try {
        GLib.spawn_command_line_async("mconnect -d");
        GLib.usleep(10000); // 10ms
    } catch (e) {
        debug("mconnect.startDaemon(): " + e);
    }
}


// Open the extension preferences window
function startPreferences() {
    debug("spawning mconnect settings");
    
    try {
        GLib.spawn_command_line_async(
            "gnome-shell-extension-prefs mconnect@andyholmes.github.io"
        );
        GLib.usleep(10000); // 10ms
    } catch (e) {
        debug("mconnect.startSettings(): " + e);
    }
}


const ProxyBase = new Lang.Class({
    Name: "ProxyBase",
    Extends: Gio.DBusProxy,
    
    _init: function (iface, dbusPath, props) {
        this.parent({
            gConnection: Gio.DBus.session,
            gInterfaceInfo: iface,
            gName: BUS_NAME,
            gObjectPath: dbusPath,
            gInterfaceName: iface.name
        });
        
        this.cancellable = new Gio.Cancellable();
        this.init(null);
        
        // Create an org.freedesktop.DBus.Properties interface
        if (props === true) {
            this.props = new PropertiesProxy(
                Gio.DBus.session,
                BUS_NAME,
                dbusPath
            );
        }
    },
    
    // Wrapper functions
    _call: function (name, variant, callback) {
        debug("mconnect.ProxyBase._call(" + name + ")");
        
        let ret;
        
        if (typeof callback === "function" || callback === true) {
            this.call(
                name,
                variant,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                (proxy, result) => {
                    try {
                        ret = this.call_finish(result);
                        
                        if (typeof callback === "function") {
                            callback(ret);
                        }
                    } catch (e) {
                        log("Error calling " + name + ": " + e.message);
                    }
                }
            );
        } else {
            ret = this.call_sync(
                name,
                variant,
                Gio.DBusCallFlags.NONE,
                -1,
                this.cancellable
            );
        }
        
        return (ret) ? ret.deep_unpack()[0] : null;
    },
    
    _get: function (name) {
        let value = this.get_cached_property(name);
        return value ? value.deep_unpack() : null;
    },

    _set: function (name, value, signature) {
        let variant = new GLib.Variant(signature, value);
        this.set_cached_property(name, variant);

        this.call(
            'org.freedesktop.DBus.Properties.Set',
            new GLib.Variant('(ssv)', [this.gInterfaceName, name, variant]),
            Gio.DBusCallFlags.NONE,
            -1,
            this.cancellable,
            (proxy, result) => {
                try {
                    this.call_finish(result);
                } catch (e) {
                    log('Error setting ' + name + ' on ' + this.gObjectPath +
                        ': ' + e.message
                    );
                }
            }
        );
    },
    
    destroy: function () {
        // TODO
        this.disconnectAll();
        delete this.props;
    }
});

Signals.addSignalMethods(ProxyBase.prototype);


// A DBus Interface wrapper for the battery plugin
const Battery = new Lang.Class({
    Name: "Battery",
    Extends: ProxyBase,
    
    _init: function (device) {
        debug("mconnect.Battery._init(" + device.gObjectPath + ")");
        
        this.parent(Interface.BATTERY, device.gObjectPath);
        
        // Properties
        Object.defineProperties(this, {
            charging: { get: () => {
                let charging = this._get("Charging");
                
                return (typeof charging === "boolean") ? charging : false;
            } },
            level: { get: () => { return this._get("Level"); } }
        });
    }
});


// A DBus Interface wrapper for the ping plugin
const Ping = new Lang.Class({
    Name: "Ping",
    Extends: ProxyBase,
    
    _init: function (device) {
        debug("mconnect.Ping._init(" + device.gObjectPath + ")");
        
        this.parent(Interface.PING, device.gObjectPath);
        
        // MConnect Signals
        this.connect("g-signal", (proxy, sender, signalName) => {
            // have the device re-emit the signal
                debug("signalName: " + signalName);
                
                if (signalName === "Ping") {
                    device.emit("received::ping", null);
                    debug("PING");
                }
        });
    }
});


// Our supported plugins mapping
const Plugins = {
    "battery": Battery,
    "ping": Ping
};


// A DBus Interface wrapper for a device
const Device = new Lang.Class({
    Name: "Device",
    Extends: ProxyBase,
    
    _init: function (dbusPath) {
        this.parent(Interface.DEVICE, dbusPath, true);
        
        // Properties
        this.plugins = {};
        
        Object.defineProperties(this, {
            // Static Properties
            address: { get: () => { return this._get("Address"); } },
            version: { get: () => { return this._get("ProtocolVersion"); } },
            id: { get: () => { return this._get("Id"); } },
            type: { get: () => { return this._get("DeviceType"); } },
            // Dynamic Immutable Properties
            name: { get: () => { return this._get("Name"); } },
            active: { get: () => {
                let active = this._get("IsActive");
                
                return (typeof active === "boolean") ? active : false;
            } },
            connected: { get: () => { return this._get("IsConnected"); } },
            paired: { get: () => { return this._get("IsPaired"); } },
            // TODO: still not clear on these two
            incomingCapabilities: { get: () => { return this._get("IncomingCapabilities"); } },
            outgoingCapabilities: { get: () => { return this._get("OutgoingCapabilities"); } },
            // Dynamic Mutable Properties
            allowed: { get: () => { return this._get("Allowed"); } }
        });
        
        // Plugins
        this._pluginsChanged();
        
        // Signals
        this.props.connectSignal("PropertiesChanged",
            (proxy, sender, data) => {
                let [iface, props, user_data] = data;
                props.forEach((p) => { props[p] = props[p].deep_unpack() });
                
                if (iface === "org.mconnect.Device") {
                    if (props.hasOwnProperty("Name")) {
                        this.emit(
                            "changed::name",
                            props["Name"] || this.name
                        );
                    }
                    
                    if (props.hasOwnProperty("Allowed")) {
                        this.emit(
                            "changed::allowed",
                            props["Allowed"] || this.allowed
                        );
                    }
                    
                    if (props.hasOwnProperty("IsActive")) {
                        this.emit(
                            "changed::active",
                            props["IsActive"] || this.active
                        );
                    }
                    
                    if (props.hasOwnProperty("IsActive")) {
                        this.emit(
                            "changed::active", 
                            props["IsConnected"] || this.connected
                        );
                    }
                    
                    if (props.hasOwnProperty("IncomingCapabilities")) {
                        this.emit(
                            "changed::plugins",
                            this.incomingCapabilities
                        );
                    } else if (props.hasOwnProperty("OutgoingCapabilities")) {
                        this.emit(
                            "changed::plugins",
                            this.outgoingCapabilities
                        );
                    }
                } else if (iface === "org.mconnect.Device.Battery") {
                    
                    this.emit(
                        "changed::battery",
                        props["Level"] || this.plugins.battery.level,
                        props["Charging"] || this.plugins.battery.charging
                    );
                }
            }
        );
    },
    
    // MConnect Callbacks
    _pluginsChanged: function (proxy, sender, cb_data) {
        // NOTE: not actually a signal yet
        debug("mconnect.Device._pluginsChanged()");
        
        this.plugins = {};
        
        for (let pluginName of this.outgoingCapabilities) {
            pluginName = pluginName.substring(11);
            
            if (Plugins.hasOwnProperty(pluginName)) {
                this.plugins[pluginName] = new Plugins[pluginName](this);
            }
        }
        
        this.emit("changed::plugins", null);
    },
    
    // Public Methods
    destroy: function () {
        for (let pluginName in this.plugins) {
            this.plugins[pluginName].destroy();
            delete this.plugins[pluginName];
        }
        delete this.props;
    }
});


// A DBus Interface wrapper for a device manager
const DeviceManager = new Lang.Class({
    Name: "DeviceManager",
    Extends: ProxyBase,
    
    _init: function () {
        this.parent(Interface.MANAGER, "/org/mconnect/manager");
        
        // Properties
        this.devices = {};
        
        Object.defineProperties(this, {
            name: {
                get: function () {
                    // TODO: this is actually a read/write property for KDE 
                    // Connect but mconnect always reports username@hostname.
                    return GLib.get_user_name() + "@" + GLib.get_host_name();
                }
            }
        });
        
        // Add currently managed devices
        this.listDevices().forEach((dbusPath) => {
            this._deviceAdded(this, dbusPath);
        });
    },
    
    // Callbacks
    _deviceAdded: function (manager, dbusPath) {
        // NOTE: not actually a signal yet
        debug("mconnect.DeviceManager._deviceAdded(" + dbusPath + ")");
        
        this.devices[dbusPath] = new Device(dbusPath);
        this.emit("device::added", null, dbusPath);
    },
    
    _deviceRemoved: function (manager, dbusPath) {
        // NOTE: not actually a signal yet
        debug("mconnect.DeviceManager._deviceRemoved(" + dbusPath + ")");
        
        this.devices[dbusPath].destroy();
        delete this.devices[dbusPath];
        this.emit("device::removed", null,  dbusPath);
    },
    
    // Methods
    allowDevice: function (dbusPath) {
        // Mark the device at *dbusPath* as allowed
        debug("mconnect.DeviceManager.allowDevice(" + dbusPath + ")");
        
        this._call("AllowDevice", new GLib.Variant('(s)', [dbusPath]), true);
    },
    
    disallowDevice: function (dbusPath) {
        // TODO: not a method yet
        // Unmark the device at *dbusPath* as unallowed
        debug("mconnect.DeviceManager.disallowDevice(" + dbusPath + ")");
        
        debug("mconnect.DeviceManager.disallowDevice(): Not Implemented")
    },
    
    listDevices: function () {
        debug("mconnect.DeviceManager.listDevices()");
        
        return this._call(
            "ListDevices",
            new GLib.Variant("()", "")
        );
    },
    
    // Override
    destroy: function () {
        for (let dbusPath in this.devices) {
            this._deviceRemoved(this, dbusPath);
        }
    }
});

