/**
 * sms.js - A simple dialog for sending SMS messages via MConnect/KDE Connect
 * with (optional) Google Contacts auto-completion via GOA.
 *
 * A great deal of credit and appreciation is owed to the indicator-kdeconnect
 * developers for the sister Python script 'Sms.py':
 * 
 * https://github.com/Bajoja/indicator-kdeconnect/blob/master/src/sms/Sms.py
 *
 */

const Lang = imports.lang;
const Gettext = imports.gettext.domain("gnome-shell-extension-mconnect");
const _ = Gettext.gettext;
const GData = imports.gi.GData;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Goa = imports.gi.Goa;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

// Local Imports
function getPath() {
    // Diced from: https://github.com/optimisme/gjs-examples/
    let m = new RegExp("@(.+):\\d+").exec((new Error()).stack.split("\n")[1]);
    return Gio.File.new_for_path(m[1]).get_parent().get_path();
}

imports.searchPath.push(getPath());
const Convenience = imports.lib;

// infer backend and init Device()
if (ARGV[0].split("/")[2] === "mconnect") {
    var DEVICE = new imports.mconnect.Device(ARGV[0]);
} else {
    log("KDE");
    var DEVICE = new imports.kdeconnect.Device(ARGV[0]);
}


/** Phone Number Type Icons (https://material.io/icons/) */                
const SVG_TYPE_HOME = GdkPixbuf.Pixbuf.new_from_stream(
    Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new('\
            <svg fill="#888" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"> \
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/> \
                <path d="M0 0h24v24H0z" fill="none"/> \
            </svg>'
        )
    ),
    null
);

const SVG_TYPE_MOBILE = GdkPixbuf.Pixbuf.new_from_stream(
    Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new('\
            <svg fill="#888" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"> \
                <path d="M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-2 20h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z"/> \
                <path d="M0 0h24v24H0z" fill="none"/> \
            </svg>'
        )
    ),
    null
);

const SVG_TYPE_WORK = GdkPixbuf.Pixbuf.new_from_stream(
    Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new('\
            <svg fill="#888" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"> \
                <path d="M0 0h24v24H0z" fill="none"/> \
                <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/> \
            </svg>'
        )
    ),
    null
);

const SVG_TYPE_OTHER = GdkPixbuf.Pixbuf.new_from_stream(
    Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new('\
            <svg fill="#888" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"> \
                <path d="M0 0h24v24H0z" fill="none"/> \
                <path d="M3 6h18V4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v-2H3V6zm10 6H9v1.78c-.61.55-1 1.33-1 2.22s.39 1.67 1 2.22V20h4v-1.78c.61-.55 1-1.34 1-2.22s-.39-1.67-1-2.22V12zm-2 5.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM22 8h-6c-.5 0-1 .5-1 1v10c0 .5.5 1 1 1h6c.5 0 1-.5 1-1V9c0-.5-.5-1-1-1zm-1 10h-4v-8h4v8z"/> \
            </svg>'
        )
    ),
    null
);

const SVG_TYPE_DEFAULT = GdkPixbuf.Pixbuf.new_from_stream(
    Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new('\
            <svg fill="#888" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"> \
                <path d="M0 0h24v24H0z" fill="none"/> \
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/> \
            </svg>'
        )
    ),
    null
);

const SVG_ACTION_SEND = GdkPixbuf.Pixbuf.new_from_stream(
    Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new('\
            <svg fill="#888" height="16" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg"> \
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/> \
                <path d="M0 0h24v24H0z" fill="none"/> \
            </svg>'
        )
    ),
    null
);

/** Phone Number types that cannot receive texts */
const NON_SMS_TYPES = [
    GData.GD_PHONE_NUMBER_FAX,
    GData.GD_PHONE_NUMBER_OTHER_FAX,
    GData.GD_PHONE_NUMBER_WORK_FAX
];

/** Phone Number types that support receiving texts */
const SUPPORTED_TYPES = [
    GData.GD_PHONE_NUMBER_HOME,
    GData.GD_PHONE_NUMBER_WORK,
    GData.GD_PHONE_NUMBER_OTHER,
    GData.GD_PHONE_NUMBER_MOBILE,
    GData.GD_PHONE_NUMBER_MAIN,
    GData.GD_PHONE_NUMBER_PAGER
];


/** A Gtk.EntryCompletion subclass for Google Contacts */
const ContactCompletion = new Lang.Class({
    Name: "ContactCompletion",
    Extends: Gtk.EntryCompletion,
    
    _init: function () {
        this.parent();
        
        // Track suggested completions
        this._matched = [];
        this._last = null;
        
        // Look for a Google account with Contacts
        let goaClient = Goa.Client.new_sync(null, null);
        let goaAccounts = goaClient.get_accounts();
        
        for (let goaAccount in goaAccounts) {
            goaAccount = goaAccounts[goaAccount].get_account();
            let isGoogle = (goaAccount.provider_type == "google");
            let hasContacts = (goaAccount.contacts_disabled != true);
            
            if (isGoogle && hasContacts) {
                this.service = new GData.ContactsService({
                    authorizer: new GData.GoaAuthorizer({
                        goa_object: goaClient.lookup_by_id(goaAccount.id)
                    })
                });
                
                break;
            }
        }
        
        // Throw an error if there isn't one
        if (!this.service) { throw Error("failed to load Google Contacts"); }
        
        // Retrieve the contacts if there is
        // TODO: multi-page/truncated feeds?
        this.contacts = [];
        let query = new GData.Query({ q: "" });
        let count = 0;
        
        while (true) {
            let feed = this.service.query_contacts(
                query, // query,
                null, // cancellable
                (contact) => {
                    if (contact.get_phone_numbers().length > 0) {
                        this.contacts.push(contact);
                    }
                },
                null
            );
            
            count += feed.items_per_page;
            query.start_index = count;
            
            if (count > feed.total_results) { break; }
        }
        
        // Define a completion model
        let listStore = new Gtk.ListStore();
        listStore.set_column_types([
            GdkPixbuf.Pixbuf,       // Contact Avatar
            GObject.TYPE_STRING,    // Contact Name
            GObject.TYPE_STRING,    // Contact Phone URI
            GdkPixbuf.Pixbuf,       // Contact Phone Type
            GObject.TYPE_OBJECT     // GDataContactsContact Object
        ]);
        
        // Load a default avatar
        let photo = Gtk.IconTheme.get_default().load_icon(
                "avatar-default-symbolic", 0, 0
        );
        
        // Populate the completion model
        for (let contact of this.contacts) {
            // TODO: BUG: https://bugzilla.gnome.org/show_bug.cgi?id=785207
//            try {
//                let [photoBytes, contentType] = contact.get_photo(
//                    this.service,
//                    null
//                );
//            } catch (e) {
//                log("Failed to retrieve contact photo: " + e.message);
//            }
            
            // Each phone number gets its own completion entry
            for (let phoneNumber of contact.get_phone_numbers()) {
                // Exclude number types that are unable to receive texts and
                // append the number type to the  the text column
                if (SUPPORTED_TYPES.indexOf(phoneNumber.relation_type) > -1) {
                    let title = [
                        contact.title, " <", phoneNumber.uri.slice(4), ">"
                    ].join("");
                    
                    // Phone Type Icon
                    let type;
                    
                    switch (phoneNumber.relation_type) {
                        case GData.GD_PHONE_NUMBER_HOME:
                            type = SVG_TYPE_HOME;
                            break;
                        case GData.GD_PHONE_NUMBER_MOBILE:
                            type = SVG_TYPE_MOBILE;
                            break;
                        case GData.GD_PHONE_NUMBER_WORK:
                            type = SVG_TYPE_WORK;
                            break;
                        case GData.GD_PHONE_NUMBER_OTHER:
                            type = SVG_TYPE_OTHER;
                            break;
                        default:
                            type = SVG_TYPE_DEFAULT;
                    }
                
                    listStore.set(
                        listStore.append(),
                        [0, 1, 2, 3, 4],
                        [photo,
                        title,
                        phoneNumber.uri.slice(4),
                        type,
                        contact]
                    );
                }
            }
        }
        
        this.set_model(listStore);
        
        // Avatar
        let avatarCell = new Gtk.CellRendererPixbuf();
        this.pack_start(avatarCell, false);
        this.add_attribute(avatarCell, "pixbuf", 0)
        // Title
        this.set_text_column(1);
        // Type Icon
        let typeCell = new Gtk.CellRendererPixbuf();
        this.pack_start(typeCell, false);
        this.add_attribute(typeCell, "pixbuf", 3);
        
        this.set_match_func(Lang.bind(this, this._match), null, null);
        this.connect("match-selected", Lang.bind(this, this._select));
    },
    
    _match: function (completion, key, tree_iter) {
        let model = completion.get_model();
        let title = model.get_value(tree_iter, 1).toLowerCase();
        let number = model.get_value(tree_iter, 2);
		let oldContacts = key.split(",").slice(0, -1);
        
        // Set key to the last or only search item, trimmed of whitespace
        if (key.indexOf(",") > -1) { key = key.split(",").pop().trim(); }
        // Return if key is empty
        if (!key.length) { return; }
        // Return if this contact has already been added
        if (oldContacts.indexOf(title) > -1) { return; }
        // Clear current matches if the key has changed and reset last key
        if (key !== this._last) { this._matched = []; }
        this._last = key;
        
        // Match title (eg. "Name (type)") and number
        if (title.indexOf(key) > -1 || number.indexOf(key) > -1) {
            this._matched.push(model.get_string_from_iter(tree_iter));
            return tree_iter;
        }
    },
    
	_select: function (completion, model, tree_iter) {
		let entry = completion.get_entry();
		let oldContacts = entry.text.split(",").slice(0, -1);
		let newContact = model.get_value(tree_iter, 1);
		
		// Ignore duplicate selections
		if (oldContacts.indexOf(newContact) > -1) { return; }
		
		entry.set_text(
		    oldContacts.join(", ")
			+ ((oldContacts.length) ? ", " : "")
			+ newContact + ", "
		);
		
		entry.set_position(-1);
		this._matched = [];
		
		return true;
	}
});

/** A Gtk.Entry subclass for contact names and phone numbers */
const ContactEntry = new Lang.Class({
    Name: "ContactEntry",
    Extends: Gtk.SearchEntry,
    
    _init: function (params) {
        let defaults = {
            hexpand: true,
            placeholder_text: _("Phone number..."),
            primary_icon_name: "call-start-symbolic",
            input_purpose: Gtk.InputPurpose.PHONE
        };
        
        this.parent(Object.assign(defaults, params));
        
        // Try to retrieve Gtk.EntryCompletion for Google Contacts 
        try {
            this.completion = new ContactCompletion();
            this.placeholder_text = _("Search contacts");
            this.primary_icon_name = "goa-account-google";
            // TODO: https://bugzilla.gnome.org/show_bug.cgi?id=780938
            //this.primary_icon_tooltip_text = _("Google Contacts");
            this.primary_icon_activatable = false;
            this.primary_icon_sensitive = true;
            this.input_purpose = Gtk.InputPurpose.FREE_FORM;
        
            // Select the first completion suggestion on "activate"
            this.connect("activate", () => { this._select(this); });
            this._has_completion = true;
        } catch (e) {
            log("Error initialize autocomplete: " + e.message);
            this._has_completion = false;
        }
        
        // Remove error class if 
        this.connect("changed", (entry) => {
            entry.secondary_icon_name = "";
            let styleContext = entry.get_style_context();
            
            if (styleContext.has_class("error")) {
                styleContext.remove_class("error");
            }
        });
    },
    
	_select: function (entry) {
		let completion = entry.get_completion();
		
		if (completion._matched.length > 0) {
		    let iter_path = completion._matched["0"];
		    let [b, iter] = completion.model.get_iter_from_string(iter_path);
		    let oldContacts = entry.text.split(",").slice(0, -1);
		    let newContact = completion.model.get_value(iter, 1);
		
		    // Ignore duplicate selections
		    if (oldContacts.indexOf(newContact) > -1) { return; }
		
		    entry.set_text(
		        oldContacts.join(", ")
			    + ((oldContacts.length) ? ", " : "")
			    + newContact + ", "
		    );
		
		    entry.set_position(-1);
		    completion._matched = [];
		} else {
		    //self.body.grab_focus()
		}
	}
});

const MessageEntry = new Lang.Class({
    Name: "MessageEntry",
    Extends: Gtk.Entry,
    
    _init: function (params) {
        let defaults = {
            hexpand: true,
            placeholder_text: _("Type message here..."),
            //secondary_icon_name: "mail-reply-sender-symbolic",
            secondary_icon_pixbuf: SVG_ACTION_SEND,
            // TODO: https://bugzilla.gnome.org/show_bug.cgi?id=780938
            //secondary_icon_tooltip_text: _("Send..."),
            secondary_icon_activatable: true,
            secondary_icon_sensitive: false
        };
        
        this.parent(Object.assign(defaults, params));
        
        this.connect("changed", (entry) => {
            this.secondary_icon_sensitive = (this.text.length) ? true : false;
        });
    }
});

/** SMS Window */
const ApplicationWindow = new Lang.Class({
    Name: "ApplicationWindow",
    Extends: Gtk.ApplicationWindow,
    
    _init: function(params) {
        let defaults = {
            title: "MConnect",
            default_width: 300,
            default_height: 300,
            icon_name: "user-available-symbolic"
        };
        
        this.parent(Object.assign(defaults, params));
        
        // HeaderBar
        this.headerBar = new Gtk.HeaderBar({
            title: _("New Message") + " - " + DEVICE.name,
            subtitle: "no Contact",
            show_close_button: true
        });
        this.set_titlebar(this.headerBar);
        
        // HeaderBar -> Contact Entry
        this.contactEntry = new ContactEntry();
        this.headerBar.custom_title = this.contactEntry;
        
        // Content
        let box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin: 6,
            spacing: 6
        });
        this.add(box);
        
        // Content -> Conversation View
        let scrolledWindow = new Gtk.ScrolledWindow({
            can_focus: false,
            hexpand: true,
            vexpand: true
        });
        box.add(scrolledWindow);
        
        let conversationFrame = new Gtk.Frame();
        scrolledWindow.add(conversationFrame);
        
        this.conversationBuffer = new Gtk.TextBuffer();
        
        let conversationView = new Gtk.TextView({
            hexpand: true,
            vexpand: true,
            cursor_visible: false,
            editable: false,
            wrap_mode: Gtk.WrapMode.WORD,
            buffer: this.conversationBuffer
        });
        conversationFrame.add(conversationView);
        
        // Content -> Message Entry
        this.messageEntry = new MessageEntry();
        
        this.messageEntry.connect("activate", (entry, signal_id, data) => {
            this.send(entry, signal_id, data);
        });
        
        this.messageEntry.connect("icon-release", (entry, signal_id, data) => {
            this.send(entry, signal_id, data);
        });
        
        box.add(this.messageEntry);
        
        // Signals
        this.connect("destroy", Gtk.main_quit);
        this.show_all();
        this.has_focus = true;
    },
    
    /** Return a list of phone numbers that the SMS will be sent to */
    send: function (entry, signal_id, event) {
        let contactItems = this.contactEntry.text.split(",").filter((s) => {
            return /\S/.test(s);
        });
        let contactNumbers = [];
        let styleContext = this.contactEntry.get_style_context();
        let model;
        
        if (this.contactEntry._has_completion) {
            model = this.contactEntry.get_completion().get_model();
        }
        
        for (let item of contactItems) {
            item = item.trim();
            let contactNumber = false;
            
            // Search the completion (if present) for an exact contact match
            if (this.contactEntry._has_completion) {
                model.foreach((model, path, iter) => {
                    if (item === model.get_value(iter, 1)) {
                        contactNumber = model.get_value(iter, 2);
                        return true;
                    }
                    
                    contactNumber = false;
                });
            }
            
            // Found a matching Contact
            if (contactNumber) {
                contactNumbers.push(contactNumber);
            // No matching Contact, but includes alpha characters
            } else if (/[a-zA-Z]/.test(item)) {
                let start = this.contactEntry.text.indexOf(item);
                let end = start + item.length;
                
                this.contactEntry.has_focus = true;
                this.contactEntry.secondary_icon_name = "dialog-error-symbolic";
                this.contactEntry.select_region(start, end);
                
                if (!styleContext.has_class("error")) {
                    styleContext.add_class("error");
                }
                
                return false;
            // Anything else can be handled by the device (libphonenumber)
            } else {
                contactNumbers.push(item);
            }
        }
        
        if (!contactNumbers.length) {
            this.contactEntry.has_focus = true;
            this.contactEntry.secondary_icon_name = "dialog-error-symbolic";
            
            if (!styleContext.has_class("error")) {
                styleContext.add_class("error");
            }
            
            return false;
        }
        
        // Send to each contactNumber
        for (let number of contactNumbers) {
            log("Sending message to '" + number + "': " + entry.text);
            DEVICE.sms(number, entry.text);
        }
        
        // Log the sent message in the Conversation View and clear the entry
        let message = "<b>Me:</b> " + entry.text + "\n";
        this.conversationBuffer.insert_markup(
            this.conversationBuffer.get_end_iter(),
            message,
            message.length
        );
        entry.text = "";
    }
});

const SMSApplication = new Lang.Class({
    Name: "SMSApplication",
    Extends: Gtk.Application,

    _init: function() {
        this.parent({
            application_id: "org.gnome.shell.extensions.mconnect.ID" + DEVICE.id,
            flags: Gio.ApplicationFlags.FLAGS_NONE,
            register_session: true
        });
        
        let application_name = _("GSM Connect");

        GLib.set_prgname(application_name);
        GLib.set_application_name(application_name);
    },

    vfunc_startup: function() {
        log("GtkApplication::startup");
        this.parent();
        this._window = new ApplicationWindow({ application: this });
    },

    vfunc_activate: function() {
        log("GtkApplication::activated");
        
        this._window.present();
    },

    vfunc_shutdown: function() {
        log("GtkApplication::shutdown");
        this.parent();
    }
});

(new SMSApplication()).run(ARGV);

