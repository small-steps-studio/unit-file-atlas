'use strict';

const KNOWN_SECTIONS = new Set(['Unit', 'Install', 'Service', 'Socket', 'Timer', 'Mount', 'Automount', 'Swap', 'Path', 'Slice', 'Scope']);
const BOOLEAN_KEYS = new Set(['RemainAfterExit', 'PrivateTmp', 'PrivateDevices', 'NoNewPrivileges', 'DynamicUser', 'Persistent', 'ProtectKernelTunables', 'ProtectKernelModules', 'ProtectControlGroups', 'RestrictSUIDSGID', 'LockPersonality', 'MemoryDenyWriteExecute', 'RestrictRealtime']);
// Boolean settings that also take a few keywords (systemd.exec): the keywords are valid values and count as applied.
const BOOLEAN_EXTRA = { PrivateTmp: ['disconnected'], ProtectControlGroups: ['private', 'strict'] };
const BOOLEAN_PROBLEM = { PrivateTmp: 'is not a boolean or disconnected', ProtectControlGroups: 'is not a boolean, private or strict' };
const TIME_KEYS = new Set(['RestartSec', 'TimeoutSec', 'TimeoutStartSec', 'TimeoutStopSec', 'WatchdogSec', 'OnBootSec', 'OnStartupSec', 'OnActiveSec', 'OnUnitActiveSec', 'OnUnitInactiveSec', 'AccuracySec', 'RandomizedDelaySec']);
const REPEATABLE_KEYS = new Set(['Description', 'Type', 'User', 'Group', 'WorkingDirectory', 'Restart', 'RestartSec', 'PIDFile', 'DynamicUser', 'TimeoutStartSec', 'TimeoutStopSec', 'RemainAfterExit', 'Persistent']);
const DEPENDENCY_KEYS = ['Requires', 'Wants', 'BindsTo', 'PartOf', 'After', 'Before', 'Conflicts', 'WantedBy', 'RequiredBy'];
const COMMAND_KEYS = ['ExecStartPre', 'ExecStart', 'ExecStartPost', 'ExecReload', 'ExecStop', 'ExecStopPost'];
const SERVICE_TYPES = new Set(['simple', 'exec', 'forking', 'oneshot', 'dbus', 'notify', 'notify-reload', 'idle']);
const RESTART_VALUES = new Set(['no', 'on-success', 'on-failure', 'on-abnormal', 'on-watchdog', 'on-abort', 'always']);
const DROP_IN_NOTE = 'This is a drop-in file: only the settings in it are shown; systemd combines it with the unit file and its other drop-ins.';

// Text from the file written into Markdown: line breaks become spaces and every character with a Markdown or HTML meaning is
// backslash-escaped, so a unit file can never add links, images, HTML, math or table cells to a report.
function mdEsc(str) {
  if (str === null || str === undefined || str === '') return '-';
  return String(str).replace(/[\r\n]+/g, ' ').replace(/([\\`*_{}\[\]()#+!|<>~&$])/g, '\\$1');
}

function isBoolean(value) {
    if (typeof value !== 'string') return false;
    const v = value.toLowerCase();
    return ['yes', 'no', 'true', 'false', 'on', 'off', '1', '0'].includes(v);
}

function isTrue(value) {
    return typeof value === 'string' && ['yes', 'true', 'on', '1'].includes(value.toLowerCase());
}

// Time units in microseconds. parseTimespan tries the longest unit name first, like systemd's parse_time.
const TIME_UNITS = [
    ['usec', 1], ['us', 1], ['µs', 1], ['μs', 1],
    ['msec', 1e3], ['ms', 1e3],
    ['seconds', 1e6], ['second', 1e6], ['sec', 1e6], ['s', 1e6],
    ['minutes', 6e7], ['minute', 6e7], ['min', 6e7], ['m', 6e7],
    ['hours', 3.6e9], ['hour', 3.6e9], ['hr', 3.6e9], ['h', 3.6e9],
    ['days', 8.64e10], ['day', 8.64e10], ['d', 8.64e10],
    ['weeks', 6.048e11], ['week', 6.048e11], ['w', 6.048e11],
    ['months', 2630016e6], ['month', 2630016e6], ['M', 2630016e6],
    ['years', 31557600e6], ['year', 31557600e6], ['y', 31557600e6]
].sort((a, b) => b[0].length - a[0].length);

function parseTimespan(value) {
    if (typeof value !== 'string') return null;
    const s = value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
    if (s === '') return null;
    if (s === 'infinity') return -1;

    const NUMBER = /(\d+)(\.\d+)?/y;
    const WHITESPACE = /[ \t\r\n]*/y;
    let pos = 0;
    let totalUs = 0;

    for (;;) {
        WHITESPACE.lastIndex = pos;
        WHITESPACE.test(s);
        pos = WHITESPACE.lastIndex;
        if (pos >= s.length) break;

        NUMBER.lastIndex = pos;
        const m = NUMBER.exec(s);
        if (!m) return null;
        const num = parseFloat(m[1] + (m[2] || ''));
        pos = NUMBER.lastIndex;

        WHITESPACE.lastIndex = pos;
        WHITESPACE.test(s);
        pos = WHITESPACE.lastIndex;

        let factor = 1e6;   // no unit: seconds
        for (const unit of TIME_UNITS) {
            if (s.startsWith(unit[0], pos)) {
                factor = unit[1];
                pos += unit[0].length;
                break;
            }
        }
        totalUs += num * factor;
    }

    if (!isFinite(totalUs)) return null;
    return Math.round(totalUs) / 1e6;
}

function isCommentLine(line) {
    const t = line.trim();
    return t.startsWith('#') || t.startsWith(';');
}

function parseUnit(text) {
    if (typeof text !== 'string') {
        return { sections: [], errors: [{ line: 1, message: 'invalid input' }] };
    }

    const lines = text.split('\n').map(l => (l.endsWith('\r') ? l.slice(0, -1) : l));
    const sections = [];
    const errors = [];
    let currentSection = null;
    let i = 0;

    while (i < lines.length) {
        const trimmed = lines[i].trim();
        const startLine = i + 1;

        if (trimmed === '' || isCommentLine(trimmed)) {
            i++;
            continue;
        }

        if (trimmed.length > 2 && trimmed.startsWith('[') && trimmed.endsWith(']')) {
            currentSection = { name: trimmed.slice(1, -1), line: startLine, entries: [] };
            sections.push(currentSection);
            i++;
            continue;
        }

        // A trailing backslash joins the next line. Comment lines inside the continuation are skipped and the
        // continuation goes on (systemd.syntax). At the end of the file the last backslash is dropped.
        let logicalLine = trimmed;
        let last = i;
        while (logicalLine.endsWith('\\')) {
            logicalLine = logicalLine.slice(0, -1).trimEnd();
            let next = last + 1;
            while (next < lines.length && isCommentLine(lines[next])) next++;
            if (next >= lines.length) {
                last = lines.length - 1;
                break;
            }
            logicalLine += ' ' + lines[next].trim();
            last = next;
        }
        i = last + 1;

        if (!currentSection) {
            errors.push({ line: startLine, message: 'line outside a section' });
            continue;
        }

        const eqIndex = logicalLine.indexOf('=');
        if (eqIndex === -1) {
            errors.push({ line: startLine, message: 'not a key=value line' });
            continue;
        }

        currentSection.entries.push({
            key: logicalLine.slice(0, eqIndex).trim(),
            value: logicalLine.slice(eqIndex + 1).trim(),
            line: startLine
        });
    }

    return { sections, errors };
}

function unitKind(text) {
    try {
        const parsed = parseUnit(text);
        const kinds = ['Service', 'Socket', 'Timer', 'Mount', 'Automount', 'Swap', 'Path', 'Slice', 'Scope'];
        for (const kind of kinds) {
            if (parsed.sections.some(s => s.name === kind)) {
                return kind.toLowerCase();
            }
        }
        return 'unknown';
    } catch (e) {
        return 'unknown';
    }
}

// What the caller says about the open file: only the base name, only to recognise drop-in files and targets.
function fileFacts(context) {
    let name = '';
    try {
        if (context && typeof context.fileName === 'string') name = context.fileName.toLowerCase();
    } catch (e) {
        name = '';
    }
    return { dropIn: name.endsWith('.conf'), target: name.endsWith('.target') };
}

function heading(title, facts) {
    return `# ${title}\n\n` + (facts.dropIn ? DROP_IN_NOTE + '\n\n' : '');
}

// All entries of every section called `name` (systemd merges repeated sections), in file order.
function mergedEntries(parsed, name) {
    const out = [];
    for (const section of parsed.sections) {
        if (section.name === name) for (const entry of section.entries) out.push(entry);
    }
    return out;
}

function lastEntry(entries, key) {
    let found = null;
    for (const e of entries) if (e.key === key) found = e;
    return found;
}

function lastValue(entries, key) {
    const e = lastEntry(entries, key);
    return e ? e.value : null;
}

// The entries of a list setting that count: an empty value resets the list, so only the non-empty entries after
// the last empty one remain.
function effectiveEntries(entries, key) {
    let kept = [];
    for (const e of entries) {
        if (e.key !== key) continue;
        if (e.value === '') kept = [];
        else kept.push(e);
    }
    return kept;
}

// The whitespace-separated unit names of a list setting, each with the line it was written on.
function listItems(entries, key) {
    const items = [];
    for (const e of effectiveEntries(entries, key)) {
        for (const name of e.value.split(/\s+/)) {
            if (name !== '') items.push({ name, line: e.line });
        }
    }
    return items;
}

function reportOverview(text, context) {
    const facts = fileFacts(context);
    try {
        const parsed = parseUnit(text);
        const kind = facts.target ? 'target' : unitKind(text);

        if (parsed.sections.length === 0) {
            return heading('Unit Overview', facts) + 'The file contains no unit sections.';
        }

        const unitEntries = mergedEntries(parsed, 'Unit');
        const installEntries = mergedEntries(parsed, 'Install');
        const description = lastValue(unitEntries, 'Description');
        let headingLine;
        if (description) {
            const ended = /[.!?]$/.test(description);
            headingLine = `${kind} unit: ${mdEsc(description)}${ended ? '' : '.'}`;
        } else {
            headingLine = `${kind} unit.`;
        }

        let md = heading('Unit Overview', facts) + `${headingLine}\n\n`;
        md += `| Section | Line | Entries |\n`;
        md += `| --- | --- | --- |\n`;

        for (const section of parsed.sections) {
            md += `| ${mdEsc(section.name)} | ${section.line} | ${section.entries.length} |\n`;
        }

        md += `\n## Dependencies\n\n`;
        const depLines = [];
        for (const key of DEPENDENCY_KEYS) {
            const source = key === 'WantedBy' || key === 'RequiredBy' ? installEntries : unitEntries;
            const units = listItems(source, key).map(item => item.name);
            if (units.length > 0) depLines.push(`| ${key} | ${mdEsc(units.join(', '))} |`);
        }

        if (depLines.length > 0) {
            md += `| Directive | Units |\n`;
            md += `| --- | --- |\n`;
            md += depLines.join('\n') + '\n';
        } else {
            md += `No dependencies declared.\n`;
        }

        md += `\n## Commands\n\n`;
        const cmdLines = [];
        for (const section of parsed.sections) {
            for (const entry of section.entries) {
                if (COMMAND_KEYS.includes(entry.key)) {
                    cmdLines.push(`| ${entry.key} | ${entry.line} | ${mdEsc(entry.value)} |`);
                }
            }
        }

        if (cmdLines.length > 0) {
            md += `| Directive | Line | Command |\n`;
            md += `| --- | --- | --- |\n`;
            md += cmdLines.join('\n') + '\n';
        } else {
            md += `No commands.\n`;
        }

        return md;
    } catch (e) {
        return '# Unit Overview\n\nError generating report.';
    }
}

function reportSyntax(text, context) {
    const facts = fileFacts(context);
    try {
        const parsed = parseUnit(text);

        if (parsed.sections.length === 0) {
            return heading('Syntax Check', facts) + 'The file contains no unit sections.';
        }

        const problems = [];

        for (const err of parsed.errors) {
            problems.push({ line: err.line, message: err.message });
        }

        for (const section of parsed.sections) {
            if (!KNOWN_SECTIONS.has(section.name) && !section.name.startsWith('X-')) {
                problems.push({ line: section.line, message: `unknown section [${mdEsc(section.name)}]` });
            }

            // The duplicate-key rule looks at one section at a time, not at merged sections.
            const seen = new Map();
            for (const entry of section.entries) {
                if (REPEATABLE_KEYS.has(entry.key)) {
                    if (seen.has(entry.key)) {
                        const firstLine = seen.get(entry.key);
                        problems.push({ line: entry.line, message: `${mdEsc(entry.key)} is set again (first on line ${firstLine}); the last value wins` });
                    } else {
                        seen.set(entry.key, entry.line);
                    }
                }
            }
        }

        problems.sort((a, b) => a.line - b.line);

        let md = heading('Syntax Check', facts);

        if (problems.length === 0) {
            md += `No problems found.\n`;
        } else {
            const count = problems.length;
            md += `${count} problem${count === 1 ? '' : 's'} found.\n\n`;
            md += `| Line | Problem |\n`;
            md += `| --- | --- |\n`;
            for (const p of problems) {
                md += `| ${p.line} | ${p.message} |\n`;   // values inside the message are escaped where the message is built
            }
        }

        return md;
    } catch (e) {
        return '# Syntax Check\n\nError generating report.';
    }
}

function reportValues(text, context) {
    const facts = fileFacts(context);
    try {
        const parsed = parseUnit(text);

        if (parsed.sections.length === 0) {
            return heading('Value Check', facts) + 'The file contains no unit sections.';
        }

        const problems = [];

        for (const section of parsed.sections) {
            for (const entry of section.entries) {
                if (entry.value === '') continue;

                if (BOOLEAN_KEYS.has(entry.key)) {
                    const extra = BOOLEAN_EXTRA[entry.key] || [];
                    if (!isBoolean(entry.value) && !extra.includes(entry.value)) {
                        problems.push({ line: entry.line, message: `${mdEsc(entry.key)}=${mdEsc(entry.value)} ${BOOLEAN_PROBLEM[entry.key] || 'is not a boolean'}` });
                    }
                } else if (TIME_KEYS.has(entry.key)) {
                    if (parseTimespan(entry.value) === null) {
                        problems.push({ line: entry.line, message: `${mdEsc(entry.key)}=${mdEsc(entry.value)} is not a valid time span` });
                    }
                } else if (entry.key === 'Type' && section.name === 'Service') {
                    if (!SERVICE_TYPES.has(entry.value)) {
                        problems.push({ line: entry.line, message: `${mdEsc(entry.key)}=${mdEsc(entry.value)} is not a valid service type` });
                    }
                } else if (entry.key === 'Restart' && section.name === 'Service') {
                    if (!RESTART_VALUES.has(entry.value)) {
                        problems.push({ line: entry.line, message: `${mdEsc(entry.key)}=${mdEsc(entry.value)} is not a valid restart setting` });
                    }
                }
            }
        }

        problems.sort((a, b) => a.line - b.line);

        let md = heading('Value Check', facts);

        if (problems.length === 0) {
            md += `All checked values are valid.\n`;
        } else {
            const count = problems.length;
            md += `${count} invalid value${count === 1 ? '' : 's'}.\n\n`;
            md += `| Line | Problem |\n`;
            md += `| --- | --- |\n`;
            for (const p of problems) {
                md += `| ${p.line} | ${p.message} |\n`;   // values inside the message are escaped where the message is built
            }
        }

        return md;
    } catch (e) {
        return '# Value Check\n\nError generating report.';
    }
}

function reportHardening(text, context) {
    const facts = fileFacts(context);
    try {
        const parsed = parseUnit(text);
        const kind = unitKind(text);

        if (parsed.sections.length === 0) {
            return heading('Service Hardening', facts) + 'The file contains no unit sections.';
        }

        if (kind !== 'service') {
            return heading('Service Hardening', facts) + 'Hardening applies to service units only.';
        }

        const serviceEntries = mergedEntries(parsed, 'Service');
        const getVal = (key) => lastValue(serviceEntries, key);
        // A setting that is a true boolean, or one of the extra keywords systemd accepts for it.
        const onValue = (key, extra) => {
            const v = getVal(key);
            return v !== null && (isTrue(v) || (extra || []).includes(v));
        };

        const settings = [
            {
                name: 'User',
                current: getVal('User'),
                recommended: 'a non-root user or DynamicUser=yes',
                applied: (() => {
                    const user = getVal('User');
                    if (user && user !== 'root' && user !== '0') return true;
                    return isTrue(getVal('DynamicUser'));
                })()
            },
            { name: 'NoNewPrivileges', current: getVal('NoNewPrivileges'), recommended: 'yes', applied: onValue('NoNewPrivileges') },
            { name: 'PrivateTmp', current: getVal('PrivateTmp'), recommended: 'yes', applied: onValue('PrivateTmp', BOOLEAN_EXTRA.PrivateTmp) },
            { name: 'PrivateDevices', current: getVal('PrivateDevices'), recommended: 'yes', applied: onValue('PrivateDevices') },
            {
                name: 'ProtectSystem',
                current: getVal('ProtectSystem'),
                recommended: 'strict',
                applied: (() => {
                    const v = getVal('ProtectSystem');
                    return v === 'strict' || v === 'full' || isTrue(v);
                })()
            },
            {
                name: 'ProtectHome',
                current: getVal('ProtectHome'),
                recommended: 'yes',
                applied: (() => {
                    const v = getVal('ProtectHome');
                    return v === 'read-only' || v === 'tmpfs' || isTrue(v);
                })()
            },
            { name: 'ProtectKernelTunables', current: getVal('ProtectKernelTunables'), recommended: 'yes', applied: onValue('ProtectKernelTunables') },
            { name: 'ProtectKernelModules', current: getVal('ProtectKernelModules'), recommended: 'yes', applied: onValue('ProtectKernelModules') },
            { name: 'ProtectControlGroups', current: getVal('ProtectControlGroups'), recommended: 'yes', applied: onValue('ProtectControlGroups', BOOLEAN_EXTRA.ProtectControlGroups) },
            { name: 'RestrictSUIDSGID', current: getVal('RestrictSUIDSGID'), recommended: 'yes', applied: onValue('RestrictSUIDSGID') },
            { name: 'LockPersonality', current: getVal('LockPersonality'), recommended: 'yes', applied: onValue('LockPersonality') },
            { name: 'MemoryDenyWriteExecute', current: getVal('MemoryDenyWriteExecute'), recommended: 'yes', applied: onValue('MemoryDenyWriteExecute') },
            { name: 'RestrictRealtime', current: getVal('RestrictRealtime'), recommended: 'yes', applied: onValue('RestrictRealtime') },
            {
                name: 'CapabilityBoundingSet',
                current: getVal('CapabilityBoundingSet'),
                recommended: 'only the capabilities the service needs',
                applied: getVal('CapabilityBoundingSet') !== null
            },
            {
                name: 'SystemCallFilter',
                current: getVal('SystemCallFilter'),
                recommended: '@system-service',
                applied: getVal('SystemCallFilter') !== null && getVal('SystemCallFilter') !== ''
            }
        ];

        const appliedCount = settings.filter(s => s.applied).length;

        let md = heading('Service Hardening', facts);
        md += `${appliedCount} of 15 hardening settings applied.\n\n`;
        md += `| Setting | Current | Recommended | Applied |\n`;
        md += `| --- | --- | --- | --- |\n`;

        for (const s of settings) {
            md += `| ${s.name} | ${s.current === null ? '-' : mdEsc(s.current)} | ${s.recommended} | ${s.applied ? 'yes' : 'no'} |\n`;
        }

        return md;
    } catch (e) {
        return '# Service Hardening\n\nError generating report.';
    }
}

function reportReliability(text, context) {
    const facts = fileFacts(context);
    try {
        const parsed = parseUnit(text);
        const kind = unitKind(text);

        if (parsed.sections.length === 0) {
            return heading('Reliability Check', facts) + 'The file contains no unit sections.';
        }

        const findings = [];

        const serviceEntries = mergedEntries(parsed, 'Service');
        const timerEntries = mergedEntries(parsed, 'Timer');
        const unitEntries = mergedEntries(parsed, 'Unit');
        const installEntries = mergedEntries(parsed, 'Install');

        // Line of the unit's own type section header (the first section with that name).
        const typeSection = kind === 'unknown' ? null : parsed.sections.find(s => s.name.toLowerCase() === kind && KNOWN_SECTIONS.has(s.name));
        const typeLine = typeSection ? typeSection.line : 1;
        const lineOf = (entry) => (entry ? entry.line : typeLine);

        if (kind === 'service') {
            const typeEntry = lastEntry(serviceEntries, 'Type');
            const type = typeEntry && typeEntry.value !== '' ? typeEntry.value : 'simple';
            const restartEntry = lastEntry(serviceEntries, 'Restart');
            const restart = restartEntry ? restartEntry.value : '';
            const restartSecEntry = lastEntry(serviceEntries, 'RestartSec');
            const restartSec = restartSecEntry ? restartSecEntry.value : '';
            const pidFile = lastValue(serviceEntries, 'PIDFile');

            if (!facts.dropIn && type !== 'oneshot' && (restart === '' || restart === 'no')) {
                findings.push({ line: lineOf(restartEntry), rule: 'Restart policy', message: 'service is not restarted when it fails; consider Restart=on-failure' });
            }

            if (!facts.dropIn && restart !== '' && restart !== 'no') {
                if (restartSec === '') {
                    findings.push({ line: lineOf(restartEntry), rule: 'Restart delay', message: 'no RestartSec: restarts after 100 ms and may hit the start limit' });
                } else if (parseTimespan(restartSec) === null) {
                    findings.push({ line: restartSecEntry.line, rule: 'Restart delay', message: `RestartSec=${mdEsc(restartSec)} is not a valid time span: the default of 100 ms applies and the service may hit the start limit` });
                }
            }

            if (type === 'forking' && !pidFile) {
                findings.push({ line: lineOf(typeEntry), rule: 'Forking PID file', message: 'Type=forking without PIDFile; systemd may track the wrong process' });
            }

            const execStarts = effectiveEntries(serviceEntries, 'ExecStart');
            if (type !== 'oneshot' && execStarts.length > 1) {
                findings.push({ line: execStarts[1].line, rule: 'Several ExecStart', message: 'only Type=oneshot may have several ExecStart= lines' });
            }
        }

        const online = listItems(unitEntries, 'After').find(item => item.name === 'network-online.target');
        if (online) {
            const pulled = ['Wants', 'Requires', 'BindsTo'].some(key => listItems(unitEntries, key).some(item => item.name === 'network-online.target'));
            if (!pulled) {
                findings.push({ line: online.line, rule: 'Network ordering', message: 'After=network-online.target without Wants=network-online.target does not pull the target in' });
            }
        }

        if (!facts.dropIn && (kind === 'service' || kind === 'timer' || kind === 'socket' || kind === 'path')) {
            const enabled = ['WantedBy', 'RequiredBy', 'Alias'].some(key => listItems(installEntries, key).length > 0);
            if (!enabled) {
                const installSection = parsed.sections.find(s => s.name === 'Install');
                findings.push({ line: installSection ? installSection.line : typeLine, rule: 'Install section', message: 'no WantedBy= in [Install]: the unit cannot be enabled' });
            }
        }

        if (kind === 'timer') {
            const onCalendar = effectiveEntries(timerEntries, 'OnCalendar');
            if (onCalendar.length > 0 && !isTrue(lastValue(timerEntries, 'Persistent'))) {
                findings.push({ line: onCalendar[0].line, rule: 'Missed timer runs', message: 'OnCalendar timer without Persistent=true skips runs missed while the machine was off' });
            }
        }

        findings.sort((a, b) => a.line - b.line);

        let md = heading('Reliability Check', facts);

        if (findings.length === 0) {
            md += `No findings.\n`;
        } else {
            const count = findings.length;
            md += `${count} finding${count === 1 ? '' : 's'}.\n\n`;
            md += `| Line | Rule | Finding |\n`;
            md += `| --- | --- | --- |\n`;
            for (const f of findings) {
                md += `| ${f.line} | ${f.rule} | ${f.message} |\n`;   // values inside a message are escaped where the message is built
            }
        }

        return md;
    } catch (e) {
        return '# Reliability Check\n\nError generating report.';
    }
}

module.exports = {
    parseUnit,
    isBoolean,
    parseTimespan,
    unitKind,
    reportOverview,
    reportSyntax,
    reportValues,
    reportHardening,
    reportReliability
};

// Caps every Markdown table of a report at 500 rows and says how many there were.
function capTables(md) {
  if (typeof md !== 'string') return md;
  const lines = md.split('\n'), out = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    if (lines[i].startsWith('|') && /^\|[ :-]+\|/.test(lines[i + 1] || '')) {
      out.push(lines[++i]);
      let n = 0;
      while (i + 1 < lines.length && lines[i + 1].startsWith('|')) { i++; n++; if (n <= 500) out.push(lines[i]); }
      if (n > 500) { out.push(''); out.push('Showing the first 500 of ' + n + ' rows.'); }
    }
  }
  return out.join('\n');
}
for (const k of Object.keys(module.exports)) {
  if (/^report/.test(k)) { const fn = module.exports[k]; module.exports[k] = function (text, context) { return capTables(fn(text, context)); }; }
}
