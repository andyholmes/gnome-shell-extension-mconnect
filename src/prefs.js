"use strict";

const Lang = imports.lang;
const Gettext = imports.gettext.domain('gnome-shell-extension-mconnect');
const _ = Gettext.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const MConnect = Me.imports.mconnect;
const KDEConnect = Me.imports.kdeconnect;
const { initTranslations, Settings, Schema } = Me.imports.lib;

const ServiceProvider = {
    MCONNECT: 0,
    KDECONNECT: 1
};


/** A Gtk.Switch subclass for boolean GSettings. */
const BoolSetting = new Lang.Class({
    Name: "BoolSetting",
    Extends: Gtk.Switch,
    
    _init: function (setting) {
        this.parent({
            visible: true,
            can_focus: true,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER
        });
    
        Settings.bind(setting, this, "active", Gio.SettingsBindFlags.DEFAULT);
    }
});

/** A Gtk.ComboBoxText subclass for GSetting choices and enumerations */
const EnumSetting = new Lang.Class({
    Name: "EnumSetting",
    Extends: Gtk.ComboBoxText,
    
    _init: function (setting) {
        this.parent({
            visible: true,
            can_focus: true,
            width_request: 160,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            expand: true
        });
        
        let key = Schema.get_key(setting);
        let enums = key.get_range().deep_unpack()[1].deep_unpack();
        
        enums.forEach((enum_nick) => {
            this.append(enum_nick, _(enum_nick)); // TODO: better
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
    
    _init: function (setting, params={}) {
        if (!params.icon) {
            params.icon = Gtk.Image.new_from_icon_name(
                "checkbox-checked-symbolic",
                Gtk.IconSize.BUTTON
            );
        }
        
        this.parent({
            image: params.icon,
            visible: true,
            can_focus: true,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
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
                label: _(flagNick),
                visible: true,
                active: (old_flags.indexOf(flagNick) > -1)
            });
            
            flag.connect("toggled", (button) => {
                let new_flags = Settings.get_value(setting).deep_unpack();
                
                if (button.active) {
                    new_flags.push(flagNick);
                } else {
                    new_flags.splice(new_flags.indexOf(flagNick), 1);
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
        
        this.connect("clicked", () => { this.popover.show_all(); });
        
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
            valign: Gtk.Align.CENTER
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
        // TODO: not sure this is working
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
    
    _init: function (setting) {
        this.parent({
            orientation: Gtk.Orientation.HORIZONTAL,
            draw_value: false,
            visible: true,
            can_focus: true,
            width_request: 160,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            expand: true
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
    
    _init: function (setting) {
        this.parent({
            text: Settings.get_string(setting),
            visible: true,
            can_focus: true,
            width_request: 160,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            expand: true
        });
    
        Settings.bind(setting, this, "text", Gio.SettingsBindFlags.DEFAULT);
    }
});

/** A Gtk.Entry subclass for all other GSettings */
const OtherSetting = new Lang.Class({
    Name: "OtherSetting",
    Extends: Gtk.Entry,
    
    _init: function (setting) {
        this.parent({
            text: Settings.get_value(setting).deep_unpack().toSource(),
            visible: true,
            can_focus: true,
            width_request: 160,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            expand: true
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

/** A composite widget for GSettings resampling Gnome Control Center panels. */
const SettingsWidget = new Lang.Class({
    Name: "SettingsWidget",
    Extends: Gtk.ScrolledWindow,
    
    _init: function (params={}) {
        this.parent({
            height_request: 400,
            can_focus: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER
        });
        
        this.box = new Gtk.Box({
            visible: true,
            can_focus: false,
            margin_left: 80,
            margin_right: 80,
            margin_top: 18,
            margin_bottom: 18,
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 18
        });
        this.add(this.box);
    },
    
    /**
     * Add and return a new section widget. If {@param title} is given, a bold
     * title will be placed above the section.
     * @param {String} title - Optional bold label placed above the section
     * @return {Gtk.Frame} section - The new Section object.
     */
    add_section: function (title) {
        if (title) {
            let label = new Gtk.Label({
                visible: true,
                can_focus: false,
                margin_start: 3,
                xalign: 0,
                use_markup: true,
                label: "<b>" + title + "</b>"
            });
            this.box.pack_start(label, false, true, 0);
        }
        
        let section = new Gtk.Frame({
            visible: true,
            can_focus: false,
            margin_bottom: 12,
            hexpand: true,
            label_xalign: 0,
            shadow_type: Gtk.ShadowType.IN
        });
        this.box.add(section);
        
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
    
    /** Add @widget to @section with @label. */
    add_item: function (section, summary, description, widget) {
        // Row
        let itemRow = new Gtk.ListBoxRow({
            visible: true,
            can_focus: true,
            activatable: false,
            selectable: false
        });
        section.list.add(itemRow);
        
        // Row Layout
        let itemGrid = new Gtk.Grid({
            visible: true,
            can_focus: false,
            column_spacing: 16,
            row_spacing: 0,
            margin_left: 12,
            margin_top: 6,
            margin_bottom: 6,
            margin_right: 12
        });
        itemRow.add(itemGrid);
        
        // Setting Summary
        let itemSummary = new Gtk.Label({
            visible: true,
            can_focus: false,
            xalign: 0,
            hexpand: true,
            label: summary
        });
        itemGrid.attach(itemSummary, 0, 0, 1, 1);
        
        // Setting Description
        if (description !== undefined) {
            let itemDescription = new Gtk.Label({
                visible: true,
                can_focus: false,
                xalign: 0,
                hexpand: true,
                label: description,
                wrap: true
            });
            itemDescription.get_style_context().add_class("dim-label");
            itemGrid.attach(itemDescription, 0, 1, 1, 1);
        }
        
        let widgetHeight = (description !== null) ? 2 : 1;
        itemGrid.attach(widget, 1, 0, 1, widgetHeight);
        
        return itemRow;
    },
    
    /**
     * Add a new widget to @section for @setting.
     *
     * @param {Gtk.Frame} section - The section widget to attach to
     * @param {string} setting - GSetting key name
     */
    add_setting: function (section, setting) {
        let widget;
        let key = Schema.get_key(setting);
        let range = key.get_range().deep_unpack()[0];
        let type = key.get_value_type().dup_string();
        type = (range !== "type") ? range : type;
        
        if (type === "b") {
            widget = new BoolSetting(setting);
        } else if (type === "enum") {
            widget = new EnumSetting(setting);
        } else if (type === "flags") {
            widget = new FlagsSetting(setting);
        } else if (type === "mb") {
            widget = new MaybeSetting(setting);
        } else if (type.length === 1 && "ynqiuxthd".indexOf(type) > -1) {
            widget = new NumberSetting(setting, type);
        } else if (type === "range") {
            widget = new RangeSetting(setting);
        } else if (type.length === 1 && "sog".indexOf(type) > -1) {
            widget = new StringSetting(setting);
        } else {
            widget = new OtherSetting(setting);
        }
        
        return this.add_item(
            section,
            key.get_summary(),
            key.get_description(),
            widget
        );
    }
});


function init() {
    initTranslations();
}

// Extension Preferences
function buildPrefsWidget() {
    let widget = new SettingsWidget();
    
    let preferencesSection = widget.add_section(_("Preferences"));
    widget.add_setting(preferencesSection, "device-indicators");
    widget.add_setting(preferencesSection, "device-automount");
    widget.add_setting(preferencesSection, "device-visibility");
    widget.add_setting(preferencesSection, "nautilus-integration");
    
    let serviceSection = widget.add_section(_("Service"));
    widget.add_setting(serviceSection, "service-provider");
    widget.add_setting(serviceSection, "service-autostart");
    let button = new Gtk.Button({
        image: Gtk.Image.new_from_icon_name(
            "preferences-system-symbolic",
            Gtk.IconSize.BUTTON
        ),
        visible: true,
        can_focus: true,
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER
    });
    button.get_style_context().add_class("circular");
    button.connect("clicked", (button) => {
        if (Settings.get_enum("service-provider") === ServiceProvider.MCONNECT) {
            Me.imports.mconnect.startSettings();
        } else {
            Me.imports.kdeconnect.startSettings();
        }
    });
    widget.add_item(
        serviceSection,
        _("Service Settings"),
        _("Open the settings for the current service"),
        button
    );
    
    let develSection = widget.add_section(_("Development"));
    widget.add_setting(develSection, "debug");
    //TODO: about pane
    
    widget.show_all();
    return widget;
}

