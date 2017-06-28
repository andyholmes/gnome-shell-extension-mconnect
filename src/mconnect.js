"use strict";

// Imports
const Lang = imports.lang;
const Signals = imports.signals;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { log, debug } = Me.imports.lib;


// DBus Constants
const BUS_NAME = "org.mconnect";

const DeviceNode = new Gio.DBusNodeInfo.new_for_xml('\
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

DeviceNode.nodes.forEach((nodeInfo) => { nodeInfo.cache_build(); });


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

ManagerNode.nodes.forEach((nodeInfo) => { nodeInfo.cache_build(); });

// FIXME: unecessary and cludgy
const Interface = {
    DEVICE: DeviceNode.interfaces[1],
    BATTERY: DeviceNode.interfaces[2],
    PING: DeviceNode.interfaces[3],
    FINDMYPHONE: DeviceNode.interfaces[3], // TODO: not actually supported
    SMS: DeviceNode.interfaces[3], // TODO: not actually supported
    MANAGER: ManagerNode.interfaces[0]
};


// Start the backend daemon
function startDaemon() {
    debug("spawning mconnect daemon");
    
    try {
        GLib.spawn_command_line_async("mconnect -d");
        GLib.usleep(10000); // 10ms TODO: still need this?
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
    } catch (e) {
        debug("mconnect.startSettings(): " + e);
    }
}


const ProxyBase = new Lang.Class({
    Name: "ProxyBase",
    Extends: Gio.DBusProxy,
    Signals: {
        "received": {
            flags: GObject.SignalFlags.RUN_FIRST | GObject.SignalFlags.DETAILED,
            param_types: [ GObject.TYPE_VARIANT ]
        },
        "changed": {
            flags: GObject.SignalFlags.RUN_FIRST | GObject.SignalFlags.DETAILED,
            param_types: [ GObject.TYPE_VARIANT ]
        }
    },
    
    _init: function (iface, dbusPath) {
        this.parent({
            gConnection: Gio.DBus.session,
            gInterfaceInfo: iface,
            gName: BUS_NAME,
            gObjectPath: dbusPath,
            gInterfaceName: iface.name
        });
        
        this.cancellable = new Gio.Cancellable();
        this.init(null);
        
        // Always wrap Properties and Signals
        this._wrapProperties();
        this._wrapSignals();
        // PropertiesChanged picks up all properties on the object path, not 
        // just the local interface; apply it on a per-object-path basis
        //this._wrapPropertiesChanged();
    },
    
    // Wrapper functions
    _call: function (name, variant, callback) {
        // TODO: check this
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
        debug("mconnect.ProxyBase._get(" + name + ")");
        
        let value = this.get_cached_property(name);
        return value ? value.deep_unpack() : null;
    },

    _set: function (name, value, signature) {
        // TODO: simplify this (and use it)
        debug("mconnect.ProxyBase._set(" + name + ")");
        
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
    
    _wrapProperties: function () {
        // Properties
        debug("mconnect.ProxyBase._wrapProperties()");
        
        let i;
        let properties = this.gInterfaceInfo.properties;
        
        for (i = 0; i < properties.length; i++) {
            let name = properties[i].name;
            let signature = properties[i].signature;
            
            // Homogenize property names
            let pname = (name.startsWith("Is")) ? name.slice(2) : name;
            pname = (pname.startsWith("Device")) ? pname.slice(6) : pname;
            pname = pname.toCamelCase();
            
            Object.defineProperty(this, pname, {
                get: Lang.bind(this, this._get, name),
                // TODO: not ready for prime-time
                //set: Lang.bind(this, _propertySetter, name, signature),
                configurable: true,
                enumerable: true
            });
        }
    },
    
    _wrapPropertiesChanged: function () {
        // Wrap "g-properties-changed"
        debug("mconnect.ProxyBase._wrapPropertiesChanged()");
        
        this.connect("g-properties-changed", (proxy, parameters) => {
            debug("g-properties-changed emitted");
            
            parameters = parameters.deep_unpack();
            
            for (let name in parameters) {
                debug("parameter name: " + name);
                debug("parameter value: " + parameters[name].deep_unpack());
                debug("parameter typeof: " + parameters[name].toString());
                
                // Homogenize property names
                let pname = (name.startsWith("Is")) ? name.slice(2) : name;
                pname = (pname.startsWith("Device")) ? pname.slice(6) : pname;
                pname = pname.toCamelCase();
                
                debug("lowered param: " + pname);
                
                // FIXME: cast as variant
                //this.emit("changed::" + pname, parameters[name].deep_unpack());
                this.emit("changed::" + pname, parameters[name]);
            }
        });
    },
    
    _wrapSignals: function (emitter) {
        // Wrap signals
        debug("mconnect.ProxyBase._wrapSignals()");
        
        this.connect("g-signal",
            (proxy, sender_name, signal_name, parameters) => {
                debug("g-signal emitted");
            
                debug("g-signal proxy: " + proxy.gObjectPath);
                debug("g-signal signal: " + signal_name);
                debug("g-signal sender: " + sender_name);
                debug("g-signal parameters: " + parameters);
                
                debug("proxy: " + proxy.gInterfaceName);
                
                emitter.emit("received::" + signal_name, parameters);
            }
        );
    },
    
    // Override as needed
    destroy: function () {
        //this.disconnectAll();
        this.disconnect("g-properties-changed");
        this.disconnect("g-signal");
    }
});


// A DBus Interface wrapper for a device
const Device = new Lang.Class({
    Name: "Device",
    Extends: ProxyBase,
    
    _init: function (dbusPath) {
        this.parent(Interface.DEVICE, dbusPath);
        
        // Wrap "g-properties-changed"
        this._wrapPropertiesChanged();
        
        // Plugins
        // FIXME: signal _should_ replace the need for this
        // this.connect("changed::incomingCapabilites", () => { this._pluginsChanged() } );
        // this.connect("changed::outgoingCapabilites", () => { this._pluginsChanged() } );
        this._pluginsChanged();
    },
    
    // Callbacks
    _pluginsChanged: function (proxy, sender, cb_data) {
        // NOTE: not actually a signal yet
        // FIXME: mad cludgy
        debug("mconnect.Device._pluginsChanged()");
        
        //
        let _plugins = {
            battery: false,
            ping: false,
            findmyphone: false,
            sms: false
        };
        
        // Device has gone inactive 
        if (!this.active) {
            for (let plugin in _plugins) {
                if (this.hasOwnProperty(plugin)) {
                    this[plugin].destroy();
                    delete this[plugin];
                }
            }
            
            return;
        }
        
        this.outgoingCapabilities.forEach((plugin) => {
            if (plugin === "kdeconnect.battery") { _plugins.battery = true; }
            if (plugin === "kdeconnect.ping") { _plugins.ping = true; }
        });
        
        this.incomingCapabilities.forEach((plugin) => {
            if (plugin === "kdeconnect.findmyphone.request") {
                _plugins.findmyphone = true;
            }
            if (plugin === "kdeconnect.sms.request") { _plugins.sms = true; }
        });
        
        for (let plugin in _plugins) {
            if (_plugins[plugin] === true) {
                this[plugin] = new ProxyBase(
                    Interface[plugin.toUpperCase()],
                    this.gObjectPath
                );
                
                // wrap "g-signal" and re-emit
                if (plugin === "ping") {
                    this[plugin]._wrapSignals();
                }
            } else {
                this[plugin].destroy();
                delete this[plugin];
            }
        }
        
        // FIXME: stupid type casting bs
        this.emit("changed::plugins", new GLib.Variant("()", ""));
    },
    
    // Plugin Methods
    ping: function () {
        // TODO: outgoing pings are not supported yet
        debug("mconnect.Device.ping()");
        
//        this._call(
//            "org.mconnect.Device.Ping.Ping",
//            new GLib.Variant("()", ""),
//            true
//        );
    },
    
    ring: function () {
        // TODO: findyphone is not supported yet
        debug("mconnect.Device.ring()");
        
//        this._call(
//            "org.mconnect.Device.FindMyPhone.Ring",
//            new GLib.Variant("()", ""),
//            true
//        );
    },
    
    sendSMS: function (number, message) {
        // TODO: sms/telephony is not supported yet
        debug("mconnect.Device.sendSMS()");
        
//        this._call(
//            "org.mconnect.Device.Telephony.SendSMS",
//            new GLib.Variant("(ss)", [number, message]),
//            true
//        );
    },
    
    // Override Methods
    destroy: function () {
        ["battery", "findmyphone", "ping", "sms"].forEach((plugin) => {
            if (this.hasOwnProperty(plugin)) {
                this[plugin].destroy();
                delete this[plugin];
            }
        });
    }
});


// A DBus Interface wrapper for a device manager
const DeviceManager = new Lang.Class({
    Name: "DeviceManager",
    Extends: ProxyBase,
    Signals: {
        "device": {
            flags: GObject.SignalFlags.RUN_FIRST | GObject.SignalFlags.DETAILED,
            param_types: [ GObject.TYPE_STRING ]
        }
    },
    
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
        this.emit("device::added", dbusPath);
    },
    
    _deviceRemoved: function (manager, dbusPath) {
        // NOTE: not actually a signal yet
        debug("mconnect.DeviceManager._deviceRemoved(" + dbusPath + ")");
        
        this.devices[dbusPath].destroy();
        delete this.devices[dbusPath];
        this.emit("device::removed", dbusPath);
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
        
        return this._call("ListDevices", new GLib.Variant("()", ""));
    },
    
    // Override Methods
    destroy: function () {
        for (let dbusPath in this.devices) {
            this._deviceRemoved(this, dbusPath);
        }
    }
});

