document.addEventListener("DOMContentLoaded", function () {
    const CONFIG_RELATIVE_DIR = ".config/cockpit/net-spider";
    const CONFIG_FILE_NAME = "profiles.json";
    const PIN_SLOTS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
    const SLOT_TO_GPIO = {
        P1: "GP2",
        P2: "GP3",
        P3: "GP4",
        P4: "GP5",
        P5: "GP6",
        P6: "GP7",
        P7: "GP8",
        P8: "GP9"
    };
    const GPIO_TO_SLOT = {
        GP2: "P1",
        GP3: "P2",
        GP4: "P3",
        GP5: "P4",
        GP6: "P5",
        GP7: "P6",
        GP8: "P7",
        GP9: "P8"
    };

    let profiles = [createProfile(1)];
    let selectedId = profiles[0].id;
    let activeTab = "overview";
    const switchCooldowns = {};
    let configDirectory = null;
    let configFilePath = null;

    const refs = {
        bannerStatus: document.getElementById("banner-status"),
        tabOverview: document.getElementById("tab-overview"),
        tabConfig: document.getElementById("tab-config"),
        overviewView: document.getElementById("overview-view"),
        configView: document.getElementById("config-view"),
        mcuOverviewList: document.getElementById("mcu-overview-list"),
        deviceList: document.getElementById("device-list"),
        deviceName: document.getElementById("device-name"),
        deviceIp: document.getElementById("device-ip"),
        devicePort: document.getElementById("device-port"),
        rawResponse: document.getElementById("raw-response"),
        pinConfigGrid: document.getElementById("pin-config-grid"),
        addDevice: document.getElementById("add-device"),
        deleteDevice: document.getElementById("delete-device"),
        saveDevice: document.getElementById("save-device"),
        connectDevice: document.getElementById("connect-device"),
        refreshStatus: document.getElementById("refresh-status")
    };

    refs.tabOverview.addEventListener("click", function () {
        switchTab("overview");
    });
    refs.tabConfig.addEventListener("click", function () {
        switchTab("config");
    });
    refs.addDevice.addEventListener("click", onAddDevice);
    refs.deleteDevice.addEventListener("click", onDeleteDevice);
    refs.saveDevice.addEventListener("click", onSaveDevice);
    refs.connectDevice.addEventListener("click", onConnect);
    refs.refreshStatus.addEventListener("click", onFetchStatus);

    initializePage();

    async function initializePage() {
        await loadProfilesFromHost();
        renderAll();
    }

    function defaultPin(slot) {
        return {
            slot,
            gpio: SLOT_TO_GPIO[slot],
            name: "",
            mode: "raw",
            switchOnGpio: "ON",
            switchOffGpio: "OFF",
            switchOnDelay: 5,
            meanings: {
                ON: "",
                OFF: "",
                NEUTRAL: ""
            },
            lastState: "UNKNOWN"
        };
    }

    function createProfile(seed) {
        return {
            id: String(Date.now() + Math.random()),
            name: "MCU " + seed,
            ip: "192.168.1.200",
            port: 5000,
            pins: PIN_SLOTS.map(defaultPin),
            lastRawStatus: "No status fetched yet.",
            lastSeen: null
        };
    }

    async function resolveConfigPaths() {
        if (configFilePath && configDirectory) {
            return;
        }

        const user = await cockpit.user();
        configDirectory = user.home + "/" + CONFIG_RELATIVE_DIR;
        configFilePath = configDirectory + "/" + CONFIG_FILE_NAME;
    }

    async function loadProfilesFromHost() {
        await resolveConfigPaths();
        await cockpit.spawn(["mkdir", "-p", configDirectory]);

        const fileHandle = cockpit.file(configFilePath, { syntax: JSON });
        const parsed = await fileHandle.read();

        if (Array.isArray(parsed) && parsed.length > 0) {
            profiles = parsed.map(normalizeProfile);
            selectedId = profiles[0].id;
            setBanner("Loaded profiles from host file");
            return;
        }

        profiles = [createProfile(1)];
        selectedId = profiles[0].id;
        await saveProfiles();
        setBanner("Created new host profile file");
    }

    function normalizeProfile(profile, idx) {
        const safe = {
            id: profile.id || String(Date.now() + idx),
            name: profile.name || "MCU " + (idx + 1),
            ip: profile.ip || "192.168.1.200",
            port: Number(profile.port) || 5000,
            pins: PIN_SLOTS.map(slot => {
                const source = (profile.pins || []).find(pin => pin.slot === slot) || {};
                const sourceMeanings = source.meanings || {};
                return {
                    slot,
                    gpio: SLOT_TO_GPIO[slot],
                    name: source.name || "",
                    mode: source.mode === "switch" ? "switch" : "raw",
                    switchOnGpio: ["ON", "OFF", "NEUTRAL"].includes(source.switchOnGpio) ? source.switchOnGpio : "ON",
                    switchOffGpio: ["ON", "OFF", "NEUTRAL"].includes(source.switchOffGpio) ? source.switchOffGpio : "OFF",
                    switchOnDelay: typeof source.switchOnDelay === "number" && source.switchOnDelay >= 0 ? source.switchOnDelay : 5,
                    meanings: {
                        ON: sourceMeanings.ON || "",
                        OFF: sourceMeanings.OFF || "",
                        NEUTRAL: sourceMeanings.NEUTRAL || ""
                    },
                    lastState: source.lastState || "UNKNOWN"
                };
            }),
            lastRawStatus: profile.lastRawStatus || "No status fetched yet.",
            lastSeen: profile.lastSeen || null
        };

        return safe;
    }

    async function saveProfiles() {
        await resolveConfigPaths();
        await cockpit.spawn(["mkdir", "-p", configDirectory]);
        await cockpit.file(configFilePath, { syntax: JSON }).replace(profiles);
    }

    function getSelected() {
        return profiles.find(profile => profile.id === selectedId) || profiles[0];
    }

    function renderAll() {
        renderTabs();
        renderOverviewCards();
        renderDeviceList();
        renderDeviceForm();
        renderConfigPinCards();
        renderBanner();
    }

    function renderTabs() {
        const onOverview = activeTab === "overview";
        refs.tabOverview.classList.toggle("is-active", onOverview);
        refs.tabConfig.classList.toggle("is-active", !onOverview);
        refs.tabOverview.setAttribute("aria-selected", onOverview ? "true" : "false");
        refs.tabConfig.setAttribute("aria-selected", onOverview ? "false" : "true");
        refs.overviewView.classList.toggle("is-hidden", !onOverview);
        refs.configView.classList.toggle("is-hidden", onOverview);
    }

    function switchTab(tabName) {
        activeTab = tabName;
        renderTabs();
    }

    function renderOverviewCards() {
        refs.mcuOverviewList.innerHTML = "";

        profiles.forEach(profile => {
            const namedPins = profile.pins.filter(pin => pin.name && pin.name.trim() !== "");
            const card = document.createElement("div");
            card.className = "mcu-overview-card";

            card.innerHTML = `
                <div class="mcu-overview-head">
                    <div>
                        <div class="pin-title">${escapeHtml(profile.name)}</div>
                        <div class="mcu-overview-meta">${escapeHtml(profile.ip + ":" + profile.port)} | last STATUS: ${profile.lastSeen ? escapeHtml(new Date(profile.lastSeen).toLocaleString()) : "never"}</div>
                    </div>
                    <div class="button-row compact-row">
                        <button class="pf-v6-c-button pf-m-secondary" data-role="connect-profile" data-profile-id="${profile.id}">Connect</button>
                        <button class="pf-v6-c-button pf-m-primary" data-role="status-profile" data-profile-id="${profile.id}">Fetch STATUS</button>
                        <button class="pf-v6-c-button pf-m-secondary" data-role="send-all" data-profile-id="${profile.id}" data-state="ON">ALL ON</button>
                        <button class="pf-v6-c-button pf-m-secondary" data-role="send-all" data-profile-id="${profile.id}" data-state="OFF">ALL OFF</button>
                        <button class="pf-v6-c-button pf-m-secondary" data-role="send-all" data-profile-id="${profile.id}" data-state="NEUTRAL">ALL NEUTRAL</button>
                    </div>
                </div>
                <div class="named-pin-list"></div>
            `;

            const namedPinList = card.querySelector(".named-pin-list");
            if (namedPins.length === 0) {
                const empty = document.createElement("div");
                empty.className = "named-pin-row";
                empty.innerHTML = `<div class="named-pin-sub">No named GPIOs configured for this MCU. Configure names in the Config & Advanced tab.</div>`;
                namedPinList.appendChild(empty);
            } else {
                namedPins.forEach(pin => {
                    const row = document.createElement("div");
                    row.className = "named-pin-row";
                    const semState = pinSemanticState(pin);
                    const stateClass = pinSemanticStateClass(pin);
                    let controlsHtml;
                    if (pin.mode === "switch") {
                        controlsHtml = `
                            <div class="button-row compact-row">
                                <button class="pf-v6-c-button pf-m-secondary" data-role="send-pin" data-profile-id="${profile.id}" data-slot="${pin.slot}" data-state="${pin.switchOnGpio}" data-switch-role="on">ON</button>
                                <button class="pf-v6-c-button pf-m-secondary" data-role="send-pin" data-profile-id="${profile.id}" data-slot="${pin.slot}" data-state="${pin.switchOffGpio}" data-switch-role="off">OFF</button>
                            </div>`;
                    } else {
                        controlsHtml = `
                            <div class="button-row compact-row">
                                <button class="pf-v6-c-button pf-m-secondary" data-role="send-pin" data-profile-id="${profile.id}" data-slot="${pin.slot}" data-state="ON">HIGH</button>
                                <button class="pf-v6-c-button pf-m-secondary" data-role="send-pin" data-profile-id="${profile.id}" data-slot="${pin.slot}" data-state="OFF">LOW</button>
                                <button class="pf-v6-c-button pf-m-secondary" data-role="send-pin" data-profile-id="${profile.id}" data-slot="${pin.slot}" data-state="NEUTRAL">NEUTRAL</button>
                            </div>`;
                    }
                    row.innerHTML = `
                        <div class="named-pin-top">
                            <div>
                                <div class="named-pin-title">${escapeHtml(pin.name)}</div>
                                <div class="named-pin-sub">${pin.slot} / ${pin.gpio}${pin.mode === "switch" ? " &middot; switch" : ""}</div>
                            </div>
                            <div class="pin-state ${stateClass}">${escapeHtml(semState)}</div>
                        </div>
                        <div class="named-pin-meaning">${escapeHtml(formatMeanings(pin))}</div>
                        ${controlsHtml}
                    `;
                    namedPinList.appendChild(row);
                });
            }

            refs.mcuOverviewList.appendChild(card);
        });

        refs.mcuOverviewList.querySelectorAll("button[data-role='connect-profile']").forEach(button => {
            button.addEventListener("click", onConnect);
        });
        refs.mcuOverviewList.querySelectorAll("button[data-role='status-profile']").forEach(button => {
            button.addEventListener("click", onFetchStatus);
        });
        refs.mcuOverviewList.querySelectorAll("button[data-role='send-pin']").forEach(button => {
            button.addEventListener("click", onSendPinCommand);
        });
        refs.mcuOverviewList.querySelectorAll("button[data-role='send-all']").forEach(button => {
            button.addEventListener("click", onSendAllCommand);
        });

        applyAllCooldowns();
    }

    function formatMeanings(pin) {
        if (pin.mode === "switch") {
            const on = pin.meanings.ON ? pin.meanings.ON : "(not defined)";
            const off = pin.meanings.OFF ? pin.meanings.OFF : "(not defined)";
            return "ON (\u2192 GPIO " + gpioStateLabel(pin.switchOnGpio) + "): " + on + " | OFF (\u2192 GPIO " + gpioStateLabel(pin.switchOffGpio) + "): " + off;
        }
        const on = pin.meanings.ON ? pin.meanings.ON : "(not defined)";
        const off = pin.meanings.OFF ? pin.meanings.OFF : "(not defined)";
        const neutral = pin.meanings.NEUTRAL ? pin.meanings.NEUTRAL : "(not defined)";
        return "GPIO HIGH -> " + on + " | GPIO LOW -> " + off + " | GPIO NEUTRAL -> " + neutral;
    }

    function gpioStateLabel(state) {
        if (state === "ON") {
            return "HIGH";
        }
        if (state === "OFF") {
            return "LOW";
        }
        return state;
    }

    function pinSemanticState(pin) {
        if (pin.mode === "switch") {
            if (pin.lastState === pin.switchOnGpio) return "ON";
            if (pin.lastState === pin.switchOffGpio) return "OFF";
            return pin.lastState === "UNKNOWN" ? "UNKNOWN" : "?" + pin.lastState + "?";
        }
        return gpioStateLabel(pin.lastState);
    }

    function pinSemanticStateClass(pin) {
        const s = pinSemanticState(pin);
        return stateClassName(s);
    }

    function renderDeviceList() {
        refs.deviceList.innerHTML = "";
        profiles.forEach(profile => {
            const item = document.createElement("div");
            item.className = "device-item" + (profile.id === selectedId ? " active" : "");
            item.textContent = profile.name + " (" + profile.ip + ":" + profile.port + ")";
            item.addEventListener("click", function () {
                selectedId = profile.id;
                renderAll();
            });
            refs.deviceList.appendChild(item);
        });
    }

    function renderDeviceForm() {
        const selected = getSelected();
        refs.deviceName.value = selected.name;
        refs.deviceIp.value = selected.ip;
        refs.devicePort.value = selected.port;
        refs.rawResponse.textContent = selected.lastRawStatus || "No status fetched yet.";
    }

    function renderConfigPinCards() {
        const selected = getSelected();
        refs.pinConfigGrid.innerHTML = "";

        selected.pins.forEach(pin => {
            const card = document.createElement("div");
            card.className = "pin-card";
            const displayedState = pinSemanticState(pin);
            const stateClass = pinSemanticStateClass(pin);
            const stateMeaning = stateMeaningLabel(pin, pin.lastState);

            const isSwitch = pin.mode === "switch";
            const switchOnSel = (v) => v === pin.switchOnGpio ? " selected" : "";
            const switchOffSel = (v) => v === pin.switchOffGpio ? " selected" : "";
            const switchMappingHtml = isSwitch ? `
                    <label>ON &rarr; GPIO</label>
                    <select data-role="switch-on-gpio" data-slot="${pin.slot}">
                        <option value="ON"${switchOnSel("ON")}>GPIO HIGH</option>
                        <option value="OFF"${switchOnSel("OFF")}>GPIO LOW</option>
                        <option value="NEUTRAL"${switchOnSel("NEUTRAL")}>GPIO NEUTRAL (hi-Z)</option>
                    </select>
                    <label>OFF &rarr; GPIO</label>
                    <select data-role="switch-off-gpio" data-slot="${pin.slot}">
                        <option value="ON"${switchOffSel("ON")}>GPIO HIGH</option>
                        <option value="OFF"${switchOffSel("OFF")}>GPIO LOW</option>
                        <option value="NEUTRAL"${switchOffSel("NEUTRAL")}>GPIO NEUTRAL (hi-Z)</option>
                    </select>
                    <label>Rearm delay (s)</label>
                    <input type="number" min="0" step="1" data-role="switch-on-delay" data-slot="${pin.slot}" value="${pin.switchOnDelay ?? 5}" placeholder="5" />` : `
                    <label>GPIO HIGH means</label>
                    <input type="text" data-role="meaning" data-state="ON" data-slot="${pin.slot}" value="${escapeHtml(pin.meanings.ON)}" placeholder="opened / enabled" />
                    <label>GPIO LOW means</label>
                    <input type="text" data-role="meaning" data-state="OFF" data-slot="${pin.slot}" value="${escapeHtml(pin.meanings.OFF)}" placeholder="closed / disabled" />
                    <label>GPIO NEUTRAL means</label>
                    <input type="text" data-role="meaning" data-state="NEUTRAL" data-slot="${pin.slot}" value="${escapeHtml(pin.meanings.NEUTRAL)}" placeholder="floating / manual" />`;
            card.innerHTML = `
                <div class="pin-heading">
                    <div class="pin-title">${pin.slot} / ${pin.gpio}</div>
                    <div class="pin-state ${stateClass}">${displayedState}${stateMeaning ? " -> " + stateMeaning : ""}</div>
                </div>
                <div class="meaning-grid">
                    <label>Name</label>
                    <input type="text" data-role="name" data-slot="${pin.slot}" value="${escapeHtml(pin.name)}" placeholder="e.g. Main Valve" />

                    <label>Mode</label>
                    <select data-role="mode" data-slot="${pin.slot}">
                        <option value="raw"${!isSwitch ? " selected" : ""}>Raw (HIGH / LOW / NEUTRAL)</option>
                        <option value="switch"${isSwitch ? " selected" : ""}>Switch (ON / OFF)</option>
                    </select>

                    ${switchMappingHtml}

                    <label>${isSwitch ? "ON label" : "HIGH label"}</label>
                    <input type="text" data-role="meaning" data-state="ON" data-slot="${pin.slot}" value="${escapeHtml(pin.meanings.ON)}" placeholder="e.g. opened" />

                    <label>${isSwitch ? "OFF label" : "LOW label"}</label>
                    <input type="text" data-role="meaning" data-state="OFF" data-slot="${pin.slot}" value="${escapeHtml(pin.meanings.OFF)}" placeholder="e.g. closed" />
                    ${!isSwitch ? `
                    <label>NEUTRAL label</label>
                    <input type="text" data-role="meaning" data-state="NEUTRAL" data-slot="${pin.slot}" value="${escapeHtml(pin.meanings.NEUTRAL)}" placeholder="floating / manual" />` : ""}
                </div>
                <div class="control-row">
                    <select data-role="set-state" data-slot="${pin.slot}">
                        <option value="ON">HIGH</option>
                        <option value="OFF">LOW</option>
                        <option value="NEUTRAL">NEUTRAL</option>
                    </select>
                    <button class="pf-v6-c-button pf-m-secondary" data-role="send-pin" data-slot="${pin.slot}">Set ${pin.slot}</button>
                </div>
            `;

            refs.pinConfigGrid.appendChild(card);
        });

        const allCard = document.createElement("div");
        allCard.className = "pin-card";
        allCard.innerHTML = `
            <div class="pin-heading">
                <div class="pin-title">Bulk Command</div>
                <div class="pin-state">Set ALL GPIOs at once</div>
            </div>
            <div class="control-row">
                <select id="set-all-state">
                    <option value="ON">HIGH</option>
                    <option value="OFF">LOW</option>
                    <option value="NEUTRAL">NEUTRAL</option>
                </select>
                <button id="set-all-button" class="pf-v6-c-button pf-m-primary">Send ALL</button>
            </div>
        `;
        refs.pinConfigGrid.appendChild(allCard);

        refs.pinConfigGrid.querySelectorAll("input[data-role='name']").forEach(input => {
            input.addEventListener("change", onPinConfigChange);
        });

        refs.pinConfigGrid.querySelectorAll("input[data-role='meaning']").forEach(input => {
            input.addEventListener("change", onPinConfigChange);
        });

        refs.pinConfigGrid.querySelectorAll("select[data-role='mode']").forEach(sel => {
            sel.addEventListener("change", onPinConfigChange);
        });

        refs.pinConfigGrid.querySelectorAll("select[data-role='switch-on-gpio']").forEach(sel => {
            sel.addEventListener("change", onPinConfigChange);
        });

        refs.pinConfigGrid.querySelectorAll("select[data-role='switch-off-gpio']").forEach(sel => {
            sel.addEventListener("change", onPinConfigChange);
        });

        refs.pinConfigGrid.querySelectorAll("input[data-role='switch-on-delay']").forEach(input => {
            input.addEventListener("change", onPinConfigChange);
        });

        refs.pinConfigGrid.querySelectorAll("button[data-role='send-pin']").forEach(button => {
            button.addEventListener("click", onSendPinCommand);
        });

        document.getElementById("set-all-button").addEventListener("click", onSendAllCommand);
    }

    function renderBanner() {
        const selected = getSelected();
        if (!selected.lastSeen) {
            refs.bannerStatus.textContent = "Selected " + selected.name + " (no successful STATUS yet)";
            return;
        }

        refs.bannerStatus.textContent = "Selected " + selected.name + " | last STATUS: " + new Date(selected.lastSeen).toLocaleString();
    }

    function setBanner(text) {
        refs.bannerStatus.textContent = text;
    }

    function stateClassName(state) {
        if (state === "ON" || state === "HIGH") {
            return "state-on";
        }
        if (state === "OFF" || state === "LOW") {
            return "state-off";
        }
        if (state === "NEUTRAL") {
            return "state-neutral";
        }
        return "";
    }

    function stateMeaningLabel(pin, state) {
        if (!pin.meanings || !pin.meanings[state]) {
            return "";
        }

        return pin.meanings[state];
    }

    function getProfileById(profileId) {
        return profiles.find(profile => profile.id === profileId) || null;
    }

    function getProfileFromEventOrSelected(event) {
        const profileId = event && event.target && event.target.dataset ? event.target.dataset.profileId : null;
        if (profileId) {
            const fromEvent = getProfileById(profileId);
            if (fromEvent) {
                selectedId = fromEvent.id;
                return fromEvent;
            }
        }

        return getSelected();
    }

    async function onAddDevice() {
        const next = createProfile(profiles.length + 1);
        profiles.push(next);
        selectedId = next.id;
        await saveProfiles();
        renderAll();
    }

    async function onDeleteDevice() {
        if (profiles.length === 1) {
            alert("Keep at least one MCU profile.");
            return;
        }

        const selected = getSelected();
        if (!confirm("Delete profile '" + selected.name + "'?")) {
            return;
        }

        profiles = profiles.filter(profile => profile.id !== selectedId);
        selectedId = profiles[0].id;
        await saveProfiles();
        renderAll();
    }

    async function onSaveDevice() {
        const selected = getSelected();
        const name = refs.deviceName.value.trim();
        const ip = refs.deviceIp.value.trim();
        const port = Number(refs.devicePort.value);

        if (!name) {
            alert("Please provide a profile name.");
            return;
        }
        if (!isValidIpv4(ip)) {
            alert("Please provide a valid IPv4 address.");
            return;
        }
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            alert("Port must be between 1 and 65535.");
            return;
        }

        selected.name = name;
        selected.ip = ip;
        selected.port = port;
        await saveProfiles();
        renderAll();
        setBanner("Saved profile for " + selected.name);
    }

    async function onPinConfigChange(event) {
        const selected = getSelected();
        const slot = event.target.dataset.slot;
        const pin = selected.pins.find(p => p.slot === slot);
        if (!pin) {
            return;
        }

        const role = event.target.dataset.role;
        if (role === "name") {
            pin.name = event.target.value;
        } else if (role === "mode") {
            pin.mode = event.target.value;
            await saveProfiles();
            renderConfigPinCards();
            renderOverviewCards();
            return;
        } else if (role === "switch-on-gpio") {
            pin.switchOnGpio = event.target.value;
        } else if (role === "switch-off-gpio") {
            pin.switchOffGpio = event.target.value;
        } else if (role === "switch-on-delay") {
            pin.switchOnDelay = Math.max(0, Number(event.target.value) || 0);
        } else if (role === "meaning") {
            const state = event.target.dataset.state;
            pin.meanings[state] = event.target.value;
        }

        await saveProfiles();
        renderOverviewCards();
    }

    async function onConnect(event) {
        const selected = getProfileFromEventOrSelected(event);
        try {
            setBanner("Connecting to " + selected.ip + ":" + selected.port + " ...");
            const response = await sendCommand(selected, "HELP");
            selected.lastRawStatus = response.trim() || "Connected (empty response).";
            selected.lastSeen = new Date().toISOString();
            saveProfiles();
            renderAll();
            setBanner("Connected to " + selected.name + " successfully");
        } catch (err) {
            const message = formatError(err);
            refs.rawResponse.textContent = "Connection failed: " + message;
            setBanner("Connection failed for " + selected.name);
        }
    }

    async function onFetchStatus(event) {
        const selected = getProfileFromEventOrSelected(event);
        try {
            setBanner("Fetching STATUS from " + selected.name + " ...");
            const response = await sendCommand(selected, "STATUS");
            selected.lastRawStatus = response.trim() || "STATUS returned empty response.";
            selected.lastSeen = new Date().toISOString();
            applyStatusToPins(selected, response);
            saveProfiles();
            renderAll();
            setBanner("STATUS updated for " + selected.name);
        } catch (err) {
            const message = formatError(err);
            refs.rawResponse.textContent = "STATUS failed: " + message;
            setBanner("STATUS failed for " + selected.name);
        }
    }

    async function onSendPinCommand(event) {
        const selected = getProfileFromEventOrSelected(event);
        const slot = event.target.dataset.slot;
        let desiredState = event.target.dataset.state;

        if (!desiredState) {
            const parent = event.target.closest(".pin-card") || event.target.parentElement;
            const select = parent.querySelector("select[data-role='set-state'][data-slot='" + slot + "']");
            desiredState = select ? select.value : null;
        }

        if (!desiredState) {
            refs.rawResponse.textContent = "Could not determine desired state for " + slot;
            return;
        }

        try {
            setBanner("Sending " + slot + " " + desiredState + " ...");
            const response = await sendCommand(selected, slot + " " + desiredState);
            selected.lastRawStatus = response.trim() || "Command accepted.";
            const pin = selected.pins.find(p => p.slot === slot);
            if (pin) {
                pin.lastState = desiredState;
                if (pin.mode === "switch" && desiredState === pin.switchOffGpio) {
                    startSwitchCooldown(selected.id, slot, pin);
                }
            }
            saveProfiles();
            renderAll();
            setBanner("Applied " + slot + " " + desiredState + " on " + selected.name);
        } catch (err) {
            refs.rawResponse.textContent = "Command failed: " + formatError(err);
            setBanner("Command failed for " + selected.name);
        }
    }

    async function onSendAllCommand(event) {
        const selected = getProfileFromEventOrSelected(event);
        const desiredState = (event && event.target && event.target.dataset && event.target.dataset.state)
            ? event.target.dataset.state
            : document.getElementById("set-all-state").value;

        try {
            setBanner("Sending ALL " + desiredState + " ...");
            const response = await sendCommand(selected, "ALL " + desiredState);
            selected.lastRawStatus = response.trim() || "ALL command accepted.";
            selected.pins.forEach(pin => {
                pin.lastState = desiredState;
            });
            saveProfiles();
            renderAll();
            setBanner("Applied ALL " + desiredState + " on " + selected.name);
        } catch (err) {
            refs.rawResponse.textContent = "ALL command failed: " + formatError(err);
            setBanner("ALL command failed for " + selected.name);
        }
    }

    function applyStatusToPins(profile, raw) {
        const text = raw || "";
        const stateMap = {};
        let match;
        const pattern = /(GP\d+)=(ON|OFF|NEUTRAL)/g;

        while ((match = pattern.exec(text)) !== null) {
            stateMap[match[1]] = match[2];
        }

        profile.pins.forEach(pin => {
            const state = stateMap[pin.gpio];
            if (state) {
                pin.lastState = state;
                return;
            }

            const fallbackSlot = GPIO_TO_SLOT[pin.gpio];
            if (fallbackSlot && stateMap[fallbackSlot]) {
                pin.lastState = stateMap[fallbackSlot];
            }
        });
    }

    function sendCommand(profile, command) {
        return new Promise((resolve, reject) => {
            let output = "";
            let finished = false;
            let idleTimer = null;
            const channel = cockpit.channel({
                payload: "stream",
                address: profile.ip,
                port: Number(profile.port)
            });

            function finishSuccess() {
                if (finished) {
                    return;
                }

                finished = true;
                clearTimeout(timeout);
                if (idleTimer) {
                    clearTimeout(idleTimer);
                }
                channel.close();

                if (output.trim().length === 0) {
                    reject(new Error("No response from MCU"));
                    return;
                }

                resolve(output);
            }

            function finishError(message) {
                if (finished) {
                    return;
                }

                finished = true;
                clearTimeout(timeout);
                if (idleTimer) {
                    clearTimeout(idleTimer);
                }
                channel.close();
                reject(new Error(message));
            }

            const timeout = setTimeout(() => {
                finishError("Timeout waiting for response");
            }, 5000);

            channel.addEventListener("message", function (_event, data) {
                output += data;

                if (idleTimer) {
                    clearTimeout(idleTimer);
                }

                // Wait a short idle window to collect the full line before resolving.
                idleTimer = setTimeout(() => {
                    finishSuccess();
                }, 220);
            });

            channel.addEventListener("close", function (_event, options) {
                if (finished) {
                    return;
                }

                if (options && options.problem) {
                    finishError(options.message || options.problem);
                    return;
                }

                // If peer closes after sending data, treat that as successful completion.
                finishSuccess();
            });

            channel.send(command + "\r\n");
        });
    }

    function startSwitchCooldown(profileId, slot, pin) {
        const delay = (typeof pin.switchOnDelay === "number" && pin.switchOnDelay > 0) ? pin.switchOnDelay : 0;
        if (delay <= 0) return;

        if (!switchCooldowns[profileId]) switchCooldowns[profileId] = {};
        const existing = switchCooldowns[profileId][slot];
        if (existing) clearInterval(existing.intervalId);

        const endsAt = Date.now() + delay * 1000;

        const intervalId = setInterval(function () {
            if (Date.now() >= endsAt) {
                clearInterval(switchCooldowns[profileId][slot].intervalId);
                delete switchCooldowns[profileId][slot];
                applyCooldownToButton(profileId, slot);
            } else {
                applyCooldownToButton(profileId, slot);
            }
        }, 250);

        switchCooldowns[profileId][slot] = { endsAt, intervalId };
        applyCooldownToButton(profileId, slot);
    }

    function applyCooldownToButton(profileId, slot) {
        const btn = document.querySelector(
            "button[data-switch-role='on'][data-profile-id='" + profileId + "'][data-slot='" + slot + "']"
        );
        if (!btn) return;

        const cooldown = switchCooldowns[profileId] && switchCooldowns[profileId][slot];
        if (!cooldown || Date.now() >= cooldown.endsAt) {
            btn.disabled = false;
            btn.textContent = "ON";
            btn.classList.remove("cooldown-active");
            return;
        }

        const remaining = Math.ceil((cooldown.endsAt - Date.now()) / 1000);
        btn.disabled = true;
        btn.textContent = "ON (" + remaining + "s)";
        btn.classList.add("cooldown-active");
    }

    function applyAllCooldowns() {
        Object.keys(switchCooldowns).forEach(function (profileId) {
            Object.keys(switchCooldowns[profileId]).forEach(function (slot) {
                applyCooldownToButton(profileId, slot);
            });
        });
    }

    function isValidIpv4(ip) {
        const parts = ip.split(".");
        if (parts.length !== 4) {
            return false;
        }

        for (let i = 0; i < parts.length; i++) {
            if (!/^\d+$/.test(parts[i])) {
                return false;
            }

            const value = Number(parts[i]);
            if (value < 0 || value > 255) {
                return false;
            }
        }

        return true;
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatError(err) {
        if (!err) {
            return "Unknown error";
        }

        if (typeof err === "string") {
            return err;
        }

        return err.message || JSON.stringify(err);
    }
});