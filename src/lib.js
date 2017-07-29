/*
  Inspired by, but not derived from, the venerable 'convenience.js' which is:
  Copyright (c) 2011-2012, Giovanni Campagna <scampa.giovanni@gmail.com>
*/

const Lang = imports.lang;
const Gettext = imports.gettext;
const _ = Gettext.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;


/** Return an extension object for GJS apps not privy to Gnome Shell imports */
function getCurrentExtension() {
    // Diced from: https://github.com/optimisme/gjs-examples/
    let m = new RegExp("@(.+):\\d+").exec((new Error()).stack.split("\n")[1]);
    let dir = Gio.File.new_for_path(m[1]).get_parent();
    
    let [s, meta, tag] = dir.get_child("metadata.json").load_contents(null);
    
    return {
        metadata: JSON.parse(meta),
        uuid: this.uuid,
        // FIXME
        type: ((dir.get_path().startsWith(GLib.get_home_dir())) ? 2 : 1),
        dir: dir,
        path: dir.get_path(),
        error: "",
        hasPrefs: dir.get_child("prefs.js").query_exists(null)
    };
}

const Me = getCurrentExtension();

/**
 * The regex will match the first character if it starts with a capital letter,
 * and any alphabetic character following a space, i.e. 2 or 3 times in the
 * specified strings.
 *
 * Credits: https://stackoverflow.com/a/15829686/1108697
 */
String.prototype.toCamelCase = function() {
    return this.replace(/^([A-Z])|\s(\w)/g, function(match, p1, p2, offset) {
        if (p2) return p2.toUpperCase();
        return p1.toLowerCase();        
    });
};

/**
 * Turns someCrazyName into Some Crazy Name
 * Decent job of acroynyms:
 * ABCAcryonym => ABC Acryoynm
 * xmlHTTPRequest => Xml HTTP Request
 *
 * Credits: https://gist.github.com/mattwiebe/1005915
 */
String.prototype.unCamelCase = function(){
	return this
		// insert a space between lower & upper
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		// space before last upper in a sequence followed by lower
		.replace(/\b([A-Z]+)([A-Z])([a-z])/, '$1 $2$3')
		// uppercase the first character
		.replace(/^./, function(str){ return str.toUpperCase(); })
}

// https://gist.github.com/andrei-m/982927#gistcomment-2059365
String.prototype.levenshtein = function(b){
	var a = this, tmp;
	if (a.length === 0) { return b.length; }
	if (b.length === 0) { return a.length; }
	if (a.length > b.length) { tmp = a; a = b; b = tmp; }

	var i, j, res, alen = a.length, blen = b.length, row = Array(alen);
	for (i = 0; i <= alen; i++) { row[i] = i; }

	for (i = 1; i <= blen; i++) {
		res = i;
		for (j = 1; j <= alen; j++) {
			tmp = row[j - 1];
			row[j - 1] = res;
			res = b[i - 1] === a[j - 1] ? tmp : Math.min(tmp + 1, Math.min(res + 1, row[j] + 1));
		}
	}
	return res;
}

/******************************************************************************
 * Settings
 *
 * Functions:
 *  - getSettings
 *
 * Classes:
 *  - AboutDialog: A Gtk.AboutDialog populated from metadata.json
 *  - BoolSetting
 *  - EnumSetting
 *  - FlagsSetting
 *  - MaybeSetting
 *  - NumberSetting
 *  - RangeSetting
 *  - StringSetting
 *  - OtherSetting: Control widgets for GSettings, automatically binding
 *  - SettingsWidget: A composite widget resembling Gnome Control Center
 *
 */

/** Init GSettings for Me.metadata['gschema-id'] */
let schemaDir = Me.dir.get_child('schemas');
let schemaSrc;

if (schemaDir.query_exists(null)) {
    schemaSrc = Gio.SettingsSchemaSource.new_from_directory(
        schemaDir.get_path(),
        Gio.SettingsSchemaSource.get_default(),
        false
    );
} else {
    schemaSrc = Gio.SettingsSchemaSource.get_default();
}

const Settings = new Gio.Settings({
    settings_schema: schemaSrc.lookup(Me.metadata['gschema-id'], true)
});
const Schema = Settings.settings_schema;
 
/** A Gtk.AboutDialog subclass for Extensions built from metadata.json */
const AboutDialog = new Lang.Class({
    Name: "AboutDialog",
    Extends: Gtk.AboutDialog,
    
    _init: function (params) {
        //let logo = GdkPixbuf.Pixbuf.new_from_file_at_size("gtk.png", 64, 64)
        
        let defaults = {
            title: "TEST", // FIXME
            //logo: logo, // TODO
            logo_icon_name: "gnome-shell-extension-prefs",
            program_name: Me.metadata.name,
            version: Me.metadata.version.toString(),
            comments: Me.metadata.description,
            
            website: Me.metadata.url,
            //website_label: Me.metadata.name + _(" Website"),
            
            authors: [ "Andy Holmes <andrew.g.r.holmes@gmail.com>" ], // TODO
            //artists: Me.metadata.artists,
            translator_credits: _("translator-credits"),
            copyright: "Copyright 2017 Andy Holmes", // TODO
            
            license_type: Gtk.License.GPL_2_0, // e.g.o requires GPL-2
            wrap_license: true,
            
            modal: true,
            transient_for: null
        };
        
        this.parent(Object.assign(defaults, params));
    }
});

/** A Gtk.Switch subclass for boolean GSettings. */
const BoolSetting = new Lang.Class({
    Name: "BoolSetting",
    Extends: Gtk.Switch,
    
    /**
     * Create a new BoolSetting widget for {@param setting}.
     * @param {String} setting - the GSetting name
     */
    _init: function (setting) {
        this.parent({
            visible: true,
            can_focus: true,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            margin_right: 12
        });
    
        Settings.bind(setting, this, "active", Gio.SettingsBindFlags.DEFAULT);
    }
});

/** A Gtk.ComboBoxText subclass for GSetting choices and enumerations */
const EnumSetting = new Lang.Class({
    Name: "EnumSetting",
    Extends: Gtk.ComboBoxText,
    
    /**
     * Create a new EnumSetting widget for {@param setting}.
     * @param {String} setting - the GSetting name
     */
    _init: function (setting) {
        this.parent({
            visible: true,
            can_focus: true,
            width_request: 160,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            margin_right: 12,
            expand: true
        });
        
        let key = Schema.get_key(setting);
        let enums = key.get_range().deep_unpack()[1].deep_unpack();
        
        enums.forEach((enum_nick) => {
            this.append(enum_nick, enum_nick); // TODO: better
        });
        
        this.active_id = Settings.get_string(setting);
        
        this.connect("changed", (widget) => {
            Settings.set_string(setting, widget.get_active_id());
        });
    }
});

/** A Gtk.MenuButton subclass for GSetting flags */
const FlagsSetting = new Lang.Class({
    Name: "FlagsSetting",
    Extends: Gtk.MenuButton,
    
    /**
     * Create a new FlagsSetting widget for {@param setting}.
     * @param {String} setting - the GSetting name
     */
    _init: function (setting) {
        this.parent({
            image: Gtk.Image.new_from_icon_name(
                "checkbox-checked-symbolic",
                Gtk.IconSize.BUTTON
            ),
            visible: true,
            can_focus: true,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            margin_right: 12,
            popover: new Gtk.Popover()
        });
        this.get_style_context().add_class("circular");
        
        this.box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            visible: true,
            margin: 8
        });
        this.popover.add(this.box);
        
        let flag;
        let key = Schema.get_key(setting);
        let flags = key.get_range().deep_unpack()[1].deep_unpack();
        let old_flags = Settings.get_value(setting).deep_unpack();
        
        flags.forEach((flagNick) => {
            flag = new Gtk.CheckButton({
                label: flagNick,
                visible: true,
                active: (old_flags.indexOf(flagNick) > -1)
            });
            
            flag.connect("toggled", (button) => {
                let new_flags = Settings.get_value(setting).deep_unpack();
                
                if (button.active) {
                    new_flags.push(button.label);
                } else {
                    new_flags.splice(new_flags.indexOf(button.label), 1);
                }
                
                Settings.set_value(setting, new GLib.Variant("as", new_flags));
            });
            
            this.box.add(flag);
        });
    }
});

/** A Gtk.Button/Popover subclass for GSetting nullable booleans (maybe) */
const MaybeSetting = new Lang.Class({
    Name: "MaybeSetting",
    Extends: Gtk.Button,
    
    /**
     * Create a new MaybeSetting widget for {@param setting}.
     * @param {String} setting - the GSetting name
     */
    _init: function (setting) {
        this.parent({
            visible: true,
            can_focus: true,
            width_request: 120,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            margin_right: 12
        });
        
        this.popover = new Gtk.Popover({ relative_to: this });
        
        this.box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            visible: true,
            margin: 8
        });
        this.popover.add(this.box);
        
        let nothingButton = new Gtk.RadioButton({
            label: _("Nothing"),
            visible: true,
            active: false
        });
        nothingButton.connect("toggled", (button) => {
            if (button.active) {
                Settings.set_value(setting, new GLib.Variant("mb", null));
                this.label = button.label;
            }
        });
        this.box.add(nothingButton);
        
        let trueButton = new Gtk.RadioButton({
            label: _("True"),
            visible: true
        });
        trueButton.join_group(nothingButton);
        trueButton.connect("toggled", (button) => {
            if (button.active) {
                Settings.set_value(setting, new GLib.Variant("mb", true));
                this.label = button.label;
            }
        });
        this.box.add(trueButton);
        
        let falseButton = new Gtk.RadioButton({
            label: _("False"),
            visible: true
        });
        falseButton.join_group(nothingButton);
        falseButton.connect("toggled", (button) => {
            if (button.active) {
                Settings.set_value(setting, new GLib.Variant("mb", false));
                this.label = button.label;
            }
        });
        this.box.add(falseButton);
        
        this.connect("clicked", () => { this.popover.show_all() });
        
        let val = Settings.get_value(setting).deep_unpack();
        
        if (val === true) {
            trueButton.active = true;
            this.label = trueButton.label;
        } else if (val === false) {
            falseButton.active = true;
            this.label = falseButton.label;
        } else {
            nothingButton.active = true;
            this.label = nothingButton.label;
        }
    }
});

/** A Gtk.SpinButton subclass for unranged integer GSettings */
const NumberSetting = new Lang.Class({
    Name: "NumberSetting",
    Extends: Gtk.SpinButton,
    
    /**
     * Create a new NumberSetting widget for {@param setting}.
     * @param {String} setting - the GSetting name
     */
    _init: function (setting, type) {
        this.parent({
            climb_rate: 1.0,
            digits: (type === "d") ? 2 : 0,
            //snap_to_ticks: true,
            input_purpose: Gtk.InputPurpose.NUMBER,
            visible: true,
            can_focus: true,
            width_request: 160,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            margin_right: 12
        });
        
        let lower, upper;
        
        // FIXME: definitely not working
        if (type === "y") {
            [lower, upper] = [0, 255];
        } else if (type === "q") {
            [lower, upper] = [0, GLib.MAXUINT16];
        } else if (type === "i" || type === "h") {
            [lower, upper] = [GLib.MININT32, GLib.MAXINT32];
        } else if (type === "u") {
            [lower, upper] = [0, GLib.MAXUINT32];
        } else if (type === "x") {
            [lower, upper] = [GLib.MININT64, GLib.MAXINT64];
        } else if (type === "t") {
            [lower, upper] = [0, GLib.MAXUINT64];
        // FIXME: not sure this is working
        } else if (type === "d") {
            [lower, upper] = [2.3E-308, 1.7E+308];
        } else if (type === "n") {
            [lower, upper] = [GLib.MININT16, GLib.MAXINT16];
        }
    
        this.adjustment = new Gtk.Adjustment({
            lower: lower,
            upper: upper,
            step_increment: 1
        });
    
        Settings.bind(
            setting,
            this.adjustment,
            "value",
            Gio.SettingsBindFlags.DEFAULT
        );
    }
});

/** A Gtk.Scale subclass for ranged integer GSettings */
const RangeSetting = new Lang.Class({
    Name: "RangeSetting",
    Extends: Gtk.Scale,
    
    /**
     * Create a new RangeSetting widget for {@param setting}.
     * @param {String} setting - the GSetting name
     */
    _init: function (setting) {
        this.parent({
            orientation: Gtk.Orientation.HORIZONTAL,
            draw_value: false,
            visible: true,
            can_focus: true,
            width_request: 160,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            expand: true,
            margin_right: 12
        });
        
        let key = Schema.get_key(setting);
        let range = key.get_range().deep_unpack()[1].deep_unpack();
    
        this.adjustment = new Gtk.Adjustment({
            lower: range[0],
            upper: range[1],
            step_increment: 1
        });
    
        Settings.bind(
            setting,
            this.adjustment,
            "value",
            Gio.SettingsBindFlags.DEFAULT
        );
    }
});

/** A Gtk.Entry subclass for string GSettings */
const StringSetting = new Lang.Class({
    Name: "StringSetting",
    Extends: Gtk.Entry,
    
    /**
     * Create a new StringSetting widget for {@param setting}.
     * @param {String} setting - the GSetting name
     */
    _init: function (setting) {
        this.parent({
            text: Settings.get_string(setting),
            visible: true,
            can_focus: true,
            width_request: 160,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            expand: true,
            margin_right: 12
        });
    
        Settings.bind(setting, this, "text", Gio.SettingsBindFlags.DEFAULT);
    }
});

/** A Gtk.Entry subclass for all other GSettings */
const OtherSetting = new Lang.Class({
    Name: "OtherSetting",
    Extends: Gtk.Entry,
    
    /**
     * Create a new OtherSetting widget for {@param setting}.
     * @param {String} setting - the GSetting name
     */
    _init: function (setting) {
        this.parent({
            text: Settings.get_value(setting).deep_unpack().toSource(),
            visible: true,
            can_focus: true,
            width_request: 160,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            expand: true,
            margin_right: 12
        });
        
        this._setting = setting;
        this._type = Schema.get_key(setting).get_value_type().dup_string();

        Settings.connect("changed::" + this._setting, () => {
            this.text = Settings.get_value(setting).deep_unpack().toSource();
        });
        
        this.connect("notify::text", (entry) => {
            let styleContext = entry.get_style_context();
            
            try {
                let variant = new GLib.Variant(entry._type, eval(entry.text));
                Settings.set_value(entry._setting, variant);
                
                if (styleContext.has_class("error")) {
                    styleContext.remove_class("error");
                }
            } catch (e) {
                if (!styleContext.has_class("error")) {
                    styleContext.add_class("error");
                }
            }
        });
    }
});

/** A composite widget for GSettings resmbling Gnome Control Center panels. */
const SettingsWidget = new Lang.Class({
    Name: "SettingsWidget",
    Extends: Gtk.ScrolledWindow,
    
    _init: function (params) {
        this.parent({
            height_request: 400,
            can_focus: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER
        });
        
        // FIXME: removed dependancy on imports.misc.params without replacing
        // functionality
        if (params === undefined) {
            params = { margin: 80};
        } else if (params.margin === undefined) {
            params.margin = 80;
        }
        
        this.box = new Gtk.Box({
            visible: true,
            can_focus: false,
            margin_left: params.margin,
            margin_right: params.margin,
            margin_top: 18,
            margin_bottom: 18,
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 18
        });
        this.add(this.box)
    },
    
    /**
     * Add and return a new section widget. If {@param title} is given, a bold
     * title will be placed above the section.
     * @param {String} title - If given, a bold label will be placed above the
     * section
     * @return {Gtk.Frame} section - The new Section object.
     */
    add_section: function (title) {
        // Section Title
        if (title) {
            let label = new Gtk.Label({
                visible: true,
                can_focus: false,
                margin_start: 3,
                xalign: 0,
                use_markup: true,
                label: "<b>" + title + "</b>"
            });
            this.box.add(label, { expand: false, fill: true });
        }
        
        // Section Frame
        let section = new Gtk.Frame({
            visible: true,
            can_focus: false,
            margin_bottom: 12,
            hexpand: true,
            label_xalign: 0,
            shadow_type: Gtk.ShadowType.IN
        });
        this.box.add(section);
        
        // Section List
        section.list = new Gtk.ListBox({
            visible: true,
            can_focus: false,
            hexpand: true,
            selection_mode: Gtk.SelectionMode.NONE,
            activate_on_single_click: false
        });
        section.add(section.list);
        
        //
        return section;
    },
    
    /**
     * Add a new widget to @section for @setting. If @widget is given, it
     * should be a Gtk.Widget, such as Gtk.Switch, already bound to the
     * GSetting @setting.
     *
     * @param {Gtk.Frame} section - The section widget
     * @param {string} setting - GSetting name
     */
    add_setting: function (section, setting) {
        let key = Schema.get_key(setting);
        
        // Row
        let row = new Gtk.ListBoxRow({
            visible: true,
            can_focus: true,
            activatable: false,
            selectable: false
        });
        section.list.add(row), { expand: true, fill: false };
        
        // Row Layout
        let box = new Gtk.Box({
            visible: true,
            can_focus: false,
            valign: Gtk.Align.CENTER,
            spacing: 12
        });
        row.add(box, { expand: true, fill: false });
        
        // Setting Summary
        let label = new Gtk.Label({
            visible: true,
            can_focus: false,
            height_request: 32,
            halign: Gtk.Align.START,
            margin_left: 12,
            margin_top: 8,
            margin_bottom: 8,
            hexpand: true,
            label: key.get_summary(),
        });
        box.add(label, { expand: true, fill: false });
        
        // Setting Control
        let range = key.get_range().deep_unpack()[0];
        let type = key.get_value_type().dup_string();
        type = (range !== "type") ? range : type;
        
        if (type === "b") {
            box.add(new BoolSetting(setting));
        } else if (type === "enum") {
            box.add(new EnumSetting(setting));
        } else if (type === "flags") {
            box.add(new FlagsSetting(setting));
        } else if (type === "mb") {
            box.add(new MaybeSetting(setting));
        } else if (type.length === 1 && "ynqiuxthd".indexOf(type) > -1) {
            box.add(new NumberSetting(setting, type));
        } else if (type === "range") {
            box.add(new RangeSetting(setting));
        } else if (type.length === 1 && "sog".indexOf(type) > -1) {
            box.add(new StringSetting(setting));
        } else {
            box.add(new OtherSetting(setting));
        }
    }
});

/** ***************************************************************************
 * Translations
 */

/**
 * Initialize Gettext to load translations for metadata['gettext-domain']. If
 * there is no locale subfolder, assume it's in the same prefix as gnome-shell
 */
function initTranslations() {
    let localeDir = Me.dir.get_child('locale');
    
    if (localeDir.query_exists(null)) {
        Gettext.bindtextdomain(
            Me.metadata['gettext-domain'],
            localeDir.get_path()
        );
    } else {
        Gettext.bindtextdomain(
            Me.metadata['gettext-domain'],
            "@LOCALE_DIR@" //FIXME
        );
    }
}

/** ***************************************************************************
 * Logging
 *
 * Functions:
 *  - log
 *  - debug
 *  - assert
 */

/**
 * Prints a message to the log, prepended with the UUID of the extension
 * @param {String} msg - the message
 */
function log(msg) {
    global.log("[" + Me.metadata.uuid + "]: " + msg);
}

/**
 * Prints a message to the log, prepended with the UUID of the extension and
 * "DEBUG".
 * @param {String} msg - the debugging message
 */
function debug(msg) {
    if (Settings.get_boolean("debug")) {
        log("DEBUG: " + msg);
    };
}

/**
 * Throws Error with @msg, if @condition doesn't resolve to 'true'.
 * @param {Boolean} condition - the condition to assert
 * @param {String} msg - the assertion message
 */
function assert(condition, msg) {
    if (Settings.get_boolean("debug") && !condition) {
        throw new Error("Assertion failed: " + msg || "unknown");
    };
};

