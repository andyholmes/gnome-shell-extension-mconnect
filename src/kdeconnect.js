"use strict";

// Imports
const Lang = imports.lang;
const Signals = imports.signals;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;


// DBus Constants
const BUS_NAME = "org.kde.kdeconnect";

const ManagerNode = new Gio.DBusNodeInfo.new_for_xml('\
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

ManagerNode.nodes.forEach((nodeInfo) => { nodeInfo.cache_build(); });

const DeviceNode = new Gio.DBusNodeInfo.new_for_xml('\
<node> \
  <interface name="org.freedesktop.DBus.Properties"> \
    <method name="Get"> \
      <arg name="interface_name" type="s" direction="in"/> \
      <arg name="property_name" type="s" direction="in"/> \
      <arg name="value" type="v" direction="out"/> \
    </method> \
    <method name="Set"> \
      <arg name="interface_name" type="s" direction="in"/> \
      <arg name="property_name" type="s" direction="in"/> \
      <arg name="value" type="v" direction="in"/> \
    </method> \
    <method name="GetAll"> \
      <arg name="interface_name" type="s" direction="in"/> \
      <arg name="values" type="a{sv}" direction="out"/> \
      <annotation name="org.qtproject.QtDBus.QtTypeName.Out0" value="QVariantMap"/> \
    </method> \
    <signal name="PropertiesChanged"> \
      <arg name="interface_name" type="s" direction="out"/> \
      <arg name="changed_properties" type="a{sv}" direction="out"/> \
      <annotation name="org.qtproject.QtDBus.QtTypeName.Out1" value="QVariantMap"/> \
      <arg name="invalidated_properties" type="as" direction="out"/> \
    </signal> \
  </interface> \
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

DeviceNode.nodes.forEach((nodeInfo) => { nodeInfo.cache_build(); });

const FindMyPhoneNode = new Gio.DBusNodeInfo.new_for_xml('\
<node> \
  <interface name="org.kde.kdeconnect.device.findmyphone"> \
    <method name="connected"> \
    </method> \
    <method name="ring"> \
    </method> \
  </interface> \
</node> \
');
FindMyPhoneNode.nodes.forEach((nodeInfo) => { nodeInfo.cache_build(); });

const PingNode = new Gio.DBusNodeInfo.new_for_xml('\
<node> \
  <interface name="org.kde.kdeconnect.device.ping"> \
    <method name="connected"> \
    </method> \
    <method name="sendPing"> \
    </method> \
    <method name="sendPing"> \
      <arg name="customMessage" type="s" direction="in"/> \
    </method> \
  </interface> \
</node> \
');
PingNode.nodes.forEach((nodeInfo) => { nodeInfo.cache_build(); });

const SFTPNode = new Gio.DBusNodeInfo.new_for_xml('\
<node> \
  <interface name="org.kde.kdeconnect.device.sftp"> \
    <signal name="mounted"> \
    </signal> \
    <signal name="unmounted"> \
    </signal> \
    <method name="mount"> \
    </method> \
    <method name="unmount"> \
    </method> \
    <method name="mountAndWait"> \
      <arg type="b" direction="out"/> \
    </method> \
    <method name="isMounted"> \
      <arg type="b" direction="out"/> \
    </method> \
    <method name="startBrowsing"> \
      <arg type="b" direction="out"/> \
    </method> \
    <method name="mountPoint"> \
      <arg type="s" direction="out"/> \
    </method> \
    <method name="getDirectories"> \
      <arg type="a{sv}" direction="out"/> \
      <annotation name="org.qtproject.QtDBus.QtTypeName.Out0" value="QVariantMap"/> \
    </method> \
  </interface> \
</node> \
');
SFTPNode.nodes.forEach((nodeInfo) => { nodeInfo.cache_build(); });

const ShareNode = new Gio.DBusNodeInfo.new_for_xml('\
<node> \
  <interface name="org.kde.kdeconnect.device.share"> \
    <method name="shareUrl"> \
      <arg name="url" type="s" direction="in"/> \
    </method> \
  </interface> \
</node> \
');
ShareNode.nodes.forEach((nodeInfo) => { nodeInfo.cache_build(); });

const TelephonyNode = new Gio.DBusNodeInfo.new_for_xml('\
<node> \
  <interface name="org.kde.kdeconnect.device.telephony"> \
    <method name="sendSms"> \
      <arg name="phoneNumber" type="s" direction="in"/> \
      <arg name="messageBody" type="s" direction="in"/> \
    </method> \
  </interface> \
</node> \
');
TelephonyNode.nodes.forEach((nodeInfo) => { nodeInfo.cache_build(); });

// Start the service backend
function startService() {
    log("Spawning KDEConnect daemon");
    
    try {
        // kdeconnectd isn't in PATH (at least on Ubuntu)
        let [res, out] = GLib.spawn_command_line_sync(
            "locate -br '^kdeconnectd$'"
        );
        
        // TODO: check "-platform offscreen"
        GLib.spawn_command_line_async(out.toString() + " -platform offscreen");
    } catch (e) {
        log("Error spawning KDEConnect daemon: " + e);
    }
}

// Start the backend settings
function startPreferences() {
    log("Spawning KDEConnect settings");
    
    try {
        GLib.spawn_command_line_async("kcmshell5 kcm_kdeconnect");
    } catch (e) {
        log("Error spawning KDEConnect settings: " + e);
    }
}


const ProxyBase = new Lang.Class({
    Name: "KProxyBase",
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
    },
    
    // Wrapper functions
    _call: function (name, callback) {
        /* Convert arg_array to a *real* array */
        let args = Array.prototype.slice.call(arguments, 2);
        let methodInfo = this.gInterfaceInfo.lookup_method(name);
        let signature = [];
        let i, ret;
        
        for (i = 0; i < methodInfo.in_args.length; i++) {
            signature.push(methodInfo.in_args[i].signature);
        }
        
        let variant = new GLib.Variant("(" + signature.join("") + ")", args);
        
        if (callback) {
            this.call(name, variant, 0, -1, null, (proxy, result) => {
                let succeeded = false;
                
                try {
                    ret = this.call_finish(result);
                    succeeded = true;
                } catch (e) {
                    log("Error calling " + name + ": " + e.message);
                }
                
                if (succeeded && typeof callback === "function") {
                    return callback(ret);
                }
            });
        } else {
            ret = this.call_sync(name, variant, 0, -1, this.cancellable);
        }
        
        // If return has single arg, only return that
        if (methodInfo.out_args.length === 1) {
            return (ret) ? ret.deep_unpack()[0] : null;
        } else {
            return (ret) ? ret.deep_unpack() : null;
        }
    },
    
    _get: function (name) {
        let value = this.get_cached_property(name);
        return value ? value.deep_unpack() : null;
    },
    
    _geta: function (name) {
        let ret;

        this.call(
            "org.freedesktop.DBus.Properties.Get",
            new GLib.Variant("(ss)", [this.gInterfaceName, name]),
            Gio.DBusCallFlags.NONE,
            -1,
            this.cancellable,
            (proxy, result) => {
                try {
                    ret = this.call_finish(result).deep_unpack();
                    log("DBus.Property '" + name + "':");
                    log("    value: " + ret[0].deep_unpack());
                    log("    type: " + typeof ret[0].deep_unpack());
        
                    return (ret.length === 1) ? ret[0].deep_unpack() : ret;
                } catch (e) {
                    log("Error getting " + name + " on " + this.gObjectPath +
                        ": " + e.message
                    );
                }
            }
        );
    },

    _set: function (name, value) {
        let propertyInfo = this.gInterfaceInfo.lookup_property(name);
        let variant = new GLib.Variant(propertyInfo.signature, value);
        
        // Set the cached property first
        this.set_cached_property(name, variant);

        this.call(
            "org.freedesktop.DBus.Properties.Set",
            new GLib.Variant("(ssv)", [this.gInterfaceName, name, variant]),
            Gio.DBusCallFlags.NONE,
            -1,
            this.cancellable,
            (proxy, result) => {
                try {
                    this.call_finish(result);
                } catch (e) {
                    log("Error setting " + name + " on " + this.gObjectPath +
                        ": " + e.message
                    );
                }
            }
        );
    }
});


/** A base class for backend Battery implementations */
const Battery = new Lang.Class({
    Name: "KBattery",
    Extends: ProxyBase,
    Properties: {
        "charging": GObject.ParamSpec.boolean(
            "charging",
            "BatteryCharging",
            "Whether the battery is charging or not",
            GObject.ParamFlags.READABLE,
            false
        ),
        "level": GObject.ParamSpec.int(
            "level",
            "BatteryLevel",
            "The battery level",
            GObject.ParamFlags.READABLE,
            0, 100,
            0
        )
    },
    
    _init: function (dbusPath) {
        this.parent(DeviceNode.interfaces[2], dbusPath);
        
        //
        this.connect("g-signal", (proxy, sender, name, parameters) => {
            if (name === "stateChanged") { this.notify("charging"); }
            if (name === "chargeChanged") { this.notify("level"); }
        });
    },
    
    get charging () { return (this._call("isCharging") === true); }, // TODO
    get level () { return this._call("charge"); }
});

/** A base class for backend Device implementations */
const Device = new Lang.Class({
    Name: "KDevice",
    Extends: ProxyBase,
    Properties: {
        "id": GObject.ParamSpec.string(
            "id",
            "DeviceId",
            "The device Id",
            GObject.ParamFlags.READABLE,
            ""
        ),
        "name": GObject.ParamSpec.string(
            "name",
            "DeviceName",
            "The device name",
            GObject.ParamFlags.READABLE,
            ""
        ),
        "reachable": GObject.ParamSpec.boolean(
            "reachable",
            "DeviceState",
            "The device status",
            GObject.ParamFlags.READABLE,
            false
        ),
        "trusted": GObject.ParamSpec.boolean(
            "trusted",
            "DeviceTrusted",
            "Whether the device is trusted or not",
            GObject.ParamFlags.READABLE,
            false
        ),
        "type": GObject.ParamSpec.string(
            "type",
            "DeviceType",
            "The device type",
            GObject.ParamFlags.READABLE,
            "unknown"
        )
    },
    
    _init: function (dbusPath) {
        this.parent(DeviceNode.interfaces[1], dbusPath);
        
        // Connect to PropertiesChanged
        this.connect("g-properties-changed", (proxy, properties) => {
            properties = properties.deep_unpack();
            
            for (let name in properties) {
                if (name === "name") {
                    this.notify("name");
                } else if (name === "isReachable") {
                    this.notify("reachable");
                } else if (name === "isTrusted") {
                    this.notify("trusted");
                } else if (name === "type") {
                    this.notify("type");
                }
            }
            
            this._reloadPlugins();
        });
        
        this.connect("g-signal", (proxy, sender, name, parameters) => {
            parameters = parameters.deep_unpack();
        
            log("caught signal '" + name + "'");
            log("parameters '" + parameters + "'");
            
            if (name === "nameChanged") {
                this.notify("name");
            } else if (name === "pluginsChanged") {
                this._reloadPlugins();
            } else if (name === "reachableStatusChanged") {
                // Make sure the cached isReachable is updated
                this.set_cached_property(
                    "isReachable",
                    new GLib.Variant("b", !this.reachable)
                );
                this.notify("reachable");
            } else if (name === "trustedChanged") {
                log("Device.trustable = " + this.trustable);
                this.notify("trusted");
            }
            
            //this._reloadPlugins();
        });
        
        this._reloadPlugins();
    },
    
    // Properties
    get id () { return this.gObjectPath.split("/").pop(); },
    get name () { return this._get("name"); },
    get reachable () { return (this._get("isReachable") === true); },
    get trusted () { return (this._get("isTrusted") === true); },
    get type () { return this._get("type"); },
    
    // Methods
    ping: function () { throw Error("Not Implemented"); },
    ring: function () { this.findmyphone._call("ring", true); },
    sms: function (number, message) {
        this.telephony._call("sendSms", true, number, message);
    },
    shareURI: function (filePath) {
        this.share._call(
            "shareUrl",
            true,
            GLib.filename_to_uri(filePath, null)
        );
    },
    
    pair: function () { this._call("requestPair", null, true); },
    unpair: function () { this._call("unpair", null, true); },
    
    //
    _reloadPlugins: function () {
        let supported = this._call("loadedPlugins", false);
        
        if (supported.indexOf("kdeconnect_battery") > -1 ) {
            this.battery = new Battery(this.gObjectPath);
            
            this.battery.connect("notify", (battery) => {
                this.emit("changed::battery",
                    new GLib.Variant(
                        "(bi)",
                        [this.battery.charging, this.battery.level]
                    )
                );
            });
            
            // Kickstart the plugin
            this.emit("changed::battery",
                new GLib.Variant(
                    "(bi)",
                    [this.battery.charging, this.battery.level]
                )
            );
        } else {
            delete this.battery;
        }
        
        if (supported.indexOf("kdeconnect.ping") > -1 ) {
            this.ping = new ProxyBase(
                PingNode.interfaces[0],
                this.gObjectPath
            );
        } else {
            delete this.ping;
        }
        
        if (supported.indexOf("kdeconnect_findmyphone") > -1 ) {
            this.findmyphone = new ProxyBase(
                FindMyPhoneNode.interfaces[0],
                this.gObjectPath + "/findmyphone"
            );
        } else {
            //this.findmyphone.destroy();
            delete this.findmyphone;
        }
        
        if (supported.indexOf("kdeconnect_share") > -1 ) {
            this.share = new ProxyBase(
                ShareNode.interfaces[0],
                this.gObjectPath + "/share"
            );
        } else {
            //this.share.destroy();
            delete this.share;
        }
        
        if (supported.indexOf("kdeconnect_telephony") > -1 ) {
            this.telephony = new ProxyBase(
                TelephonyNode.interfaces[0],
                this.gObjectPath + "/telephony"
            );
        } else {
            //this.sms.destroy();
            delete this.telephony;
        }
        
        this.emit("changed::plugins", new GLib.Variant("()", ""));
    },
    
    // Override Methods
    destroy: function () {
        ["battery",
        "findmyphone",
        "ping",
        "share",
        "telephony"].forEach((plugin) => {
            if (this.hasOwnProperty(plugin)) {
                delete this[plugin];
            }
        });
    }
});


// A DBus Interface wrapper for a device manager
const DeviceManager = new Lang.Class({
    Name: "KDeviceManager",
    Extends: ProxyBase,
    Properties: {
        "name": GObject.ParamSpec.string(
            "name",
            "DeviceName",
            "The host's device name",
            GObject.ParamFlags.READWRITE,
            ""
        )
    },
    Signals: {
        "device": {
            flags: GObject.SignalFlags.RUN_FIRST | GObject.SignalFlags.DETAILED,
            param_types: [ GObject.TYPE_STRING ]
        }
    },
    
    _init: function () {
        this.parent(ManagerNode.interfaces[0], "/modules/kdeconnect");
        
        // Track our device proxies, DBus path as key
        this.devices = {};
        
        // Signals
        this.connect("g-signal", (proxy, sender, name, parameters) => {
            parameters = parameters.deep_unpack();
            
            log("caught signal '" + name + "'");
            log("parameters '" + parameters + "'");
            
            if (name === "announcedNameChanged") {
                let newName = parameters[0];
                this.notify("name");
            } else if (name === "deviceAdded") {
                let dbusPath = "/modules/kdeconnect/devices/" + parameters[0];
                this._deviceAdded(this, parameters[0]);
            } else if (name === "deviceRemoved") {
                let dbusPath = "/modules/kdeconnect/devices/" + parameters[0];
                this._deviceRemoved(this, parameters[0]);
            } else if (name === "deviceVisibilityChanged") {
                let [id, reachable] = parameters;
                let dbusPath = "/modules/kdeconnect/devices/" + id;
                this.devices[dbusPath].notify("reachable");
            }
        });
        
        // Add currently managed devices
        this.listDevices().forEach((dbusPath) => {
            this._deviceAdded(this, dbusPath);
        });
    },
    
    get name () { return this._call("announcedName", false); },
    set name (name) { this._call("setAnnouncedName", true, name); },
    
    // Callbacks
    _deviceAdded: function (manager, dbusPath) {
        log("device added: " + dbusPath);
        
        this.devices[dbusPath] = new Device(dbusPath);
        this.emit("device::added", dbusPath);
    },
    
    _deviceRemoved: function (manager, dbusPath) {
        log("device removed: " + dbusPath);
        
        this.devices[dbusPath].destroy();
        delete this.devices[dbusPath];
        this.emit("device::removed", dbusPath);
    },
    
    listDevices: function () {
        let devices = this._call("devices", false);
        
        devices.forEach((id, index_, array_) => {
            array_[index_] = "/modules/kdeconnect/devices/" + id;
        });
        
        return devices;
    },
    
    // Override Methods
    destroy: function () {
        for (let dbusPath in this.devices) {
            this._deviceRemoved(this, dbusPath);
        }
    }
});

