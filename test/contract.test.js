'use strict';
// Contract tests: written from the specification examples. Do not edit; fix src/core.js instead.
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core');

const plain = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));

test('core exports every specified function', () => {
  for (const n of ["parseUnit", "isBoolean", "parseTimespan", "unitKind", "reportOverview", "reportSyntax", "reportValues", "reportHardening", "reportReliability"]) assert.equal(typeof core[n], 'function', n);
});

test("parseUnit example 1", () => {
  assert.deepStrictEqual(plain(core.parseUnit("[Unit]\nDescription=A\n; c\n[Service]\nExecStart=/bin/a \\\n  -v\nEnvironment=\n")), {"sections": [{"name": "Unit", "line": 1, "entries": [{"key": "Description", "value": "A", "line": 2}]}, {"name": "Service", "line": 4, "entries": [{"key": "ExecStart", "value": "/bin/a -v", "line": 5}, {"key": "Environment", "value": "", "line": 7}]}], "errors": []});
});

test("parseUnit example 2", () => {
  assert.deepStrictEqual(plain(core.parseUnit("Description=x\n[Servce]\nExecStart\n")), {"sections": [{"name": "Servce", "line": 2, "entries": []}], "errors": [{"line": 1, "message": "line outside a section"}, {"line": 3, "message": "not a key=value line"}]});
});

test("parseUnit example 3", () => {
  assert.deepStrictEqual(plain(core.parseUnit("[Service]\r\nExecStart=/bin/a \\\r\n  # a note\r\n  -v \\\r\n; another\r\n  -q\r\nUser=x\r\n")), {"sections": [{"name": "Service", "line": 1, "entries": [{"key": "ExecStart", "value": "/bin/a -v -q", "line": 2}, {"key": "User", "value": "x", "line": 7}]}], "errors": []});
});

test("isBoolean example 1", () => {
  assert.deepStrictEqual(plain(core.isBoolean("Yes")), true);
});

test("isBoolean example 2", () => {
  assert.deepStrictEqual(plain(core.isBoolean("0")), true);
});

test("isBoolean example 3", () => {
  assert.deepStrictEqual(plain(core.isBoolean("maybe")), false);
});

test("parseTimespan example 1", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("5s")), 5);
});

test("parseTimespan example 2", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("1min 30s")), 90);
});

test("parseTimespan example 3", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("100ms")), 0.1);
});

test("parseTimespan example 4", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("90")), 90);
});

test("parseTimespan example 5", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("infinity")), -1);
});

test("parseTimespan example 6", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("5x")), null);
});

test("parseTimespan example 7", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("2 h")), 7200);
});

test("parseTimespan example 8", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("5 min")), 300);
});

test("parseTimespan example 9", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("55s500ms")), 55.5);
});

test("parseTimespan example 10", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("300ms20s 5day")), 432020.3);
});

test("parseTimespan example 11", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("1min30s")), 90);
});

test("parseTimespan example 12", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("10\u00b5s")), 1e-05);
});

test("parseTimespan example 13", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("1.5h")), 5400);
});

test("parseTimespan example 14", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("Infinity")), null);
});

test("parseTimespan example 15", () => {
  assert.deepStrictEqual(plain(core.parseTimespan("1.")), null);
});

test("unitKind example 1", () => {
  assert.deepStrictEqual(plain(core.unitKind("# /etc/systemd/system/web.service\n[Unit]\nDescription=Web API\nAfter=network-online.target\nRequires=postgresql.service\n\n[Service]\nType=simple\nUser=root\nExecStart=/usr/bin/node /srv/web/server.js \\\n  --port 8080\nRestart=always\nRestartSec=5x\nPrivateTmp=yes\nNoNewPrivileges=maybe\nType=notify\n\n[Install]\nWantedBy=multi-user.target\n")), "service");
});

test("unitKind example 2", () => {
  assert.deepStrictEqual(plain(core.unitKind("[Unit]\nDescription=Nightly backup\n[Timer]\nOnCalendar=*-*-* 02:00:00\n")), "timer");
});

test("unitKind example 3", () => {
  assert.deepStrictEqual(plain(core.unitKind("[Unit]\nDescription=x\n")), "unknown");
});

test("reportOverview example 1", () => {
  const md = core.reportOverview("# /etc/systemd/system/web.service\n[Unit]\nDescription=Web API\nAfter=network-online.target\nRequires=postgresql.service\n\n[Service]\nType=simple\nUser=root\nExecStart=/usr/bin/node /srv/web/server.js \\\n  --port 8080\nRestart=always\nRestartSec=5x\nPrivateTmp=yes\nNoNewPrivileges=maybe\nType=notify\n\n[Install]\nWantedBy=multi-user.target\n");
  assert.equal(typeof md, 'string');
  for (const s of ["# Unit Overview", "service unit: Web API.", "| Service | 7 | 8 |", "| After | network-online.target |", "| WantedBy | multi-user.target |", "| ExecStart | 10 | /usr/bin/node /srv/web/server.js --port 8080 |"]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportOverview example 2", () => {
  const md = core.reportOverview("# empty\n");
  assert.equal(typeof md, 'string');
  for (const s of ["# Unit Overview", "The file contains no unit sections."]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportOverview example 3", () => {
  const md = core.reportOverview("[Unit]\nDescription=Mail relay!\nAfter=network.target\nAfter=network-online.target postgresql.service\nWants=redis.service\nWants=network-online.target\nBefore=\nBefore=mail-queue.service\n\n[Service]\nExecStart=/usr/bin/relay\nRestart=on-failure\nRestartSec=3s\n\n[Unit]\nRequires=redis.service\n\n[Install]\nWantedBy=multi-user.target\n");
  assert.equal(typeof md, 'string');
  for (const s of ["service unit: Mail relay\\!\n", "| Unit | 1 | 7 |", "| Unit | 15 | 1 |", "| Requires | redis.service |", "| Wants | redis.service, network-online.target |", "| After | network.target, network-online.target, postgresql.service |", "| Before | mail-queue.service |"]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportSyntax example 1", () => {
  const md = core.reportSyntax("# /etc/systemd/system/web.service\n[Unit]\nDescription=Web API\nAfter=network-online.target\nRequires=postgresql.service\n\n[Service]\nType=simple\nUser=root\nExecStart=/usr/bin/node /srv/web/server.js \\\n  --port 8080\nRestart=always\nRestartSec=5x\nPrivateTmp=yes\nNoNewPrivileges=maybe\nType=notify\n\n[Install]\nWantedBy=multi-user.target\n");
  assert.equal(typeof md, 'string');
  for (const s of ["# Syntax Check", "1 problem found.", "| 16 | Type is set again (first on line 8); the last value wins |"]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportSyntax example 2", () => {
  const md = core.reportSyntax("Description=x\n[Servce]\nExecStart\n");
  assert.equal(typeof md, 'string');
  for (const s of ["3 problems found.", "| 1 | line outside a section |", "| 2 | unknown section [Servce] |", "| 3 | not a key=value line |"]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportSyntax example 3", () => {
  const md = core.reportSyntax("[Service]\r\nExecStart=/bin/a \\\r\n  # note\r\n  -v\r\nUser=a\r\nUser=b\r\n");
  assert.equal(typeof md, 'string');
  for (const s of ["1 problem found.", "| 6 | User is set again (first on line 5); the last value wins |"]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportValues example 1", () => {
  const md = core.reportValues("# /etc/systemd/system/web.service\n[Unit]\nDescription=Web API\nAfter=network-online.target\nRequires=postgresql.service\n\n[Service]\nType=simple\nUser=root\nExecStart=/usr/bin/node /srv/web/server.js \\\n  --port 8080\nRestart=always\nRestartSec=5x\nPrivateTmp=yes\nNoNewPrivileges=maybe\nType=notify\n\n[Install]\nWantedBy=multi-user.target\n");
  assert.equal(typeof md, 'string');
  for (const s of ["# Value Check", "2 invalid values.", "| 13 | RestartSec=5x is not a valid time span |", "| 15 | NoNewPrivileges=maybe is not a boolean |"]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportValues example 2", () => {
  const md = core.reportValues("[Unit]\nDescription=Nightly backup\n[Timer]\nOnCalendar=*-*-* 02:00:00\n");
  assert.equal(typeof md, 'string');
  for (const s of ["# Value Check", "All checked values are valid."]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportValues example 3", () => {
  const md = core.reportValues("[Mount]\nWhat=/dev/sda1\nType=ext4\n[Service]\nType=exec\nRestart=always\nRestartSec=2 h\nPrivateTmp=disconnected\nProtectControlGroups=strict\n");
  assert.equal(typeof md, 'string');
  for (const s of ["All checked values are valid."]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportValues example 4", () => {
  const md = core.reportValues("[Service]\nType=ext4\nPrivateTmp=private\nProtectControlGroups=private\nProtectControlGroups=yes\nProtectControlGroups=nope\nRestartSec=1.s\n");
  assert.equal(typeof md, 'string');
  for (const s of ["4 invalid values.", "| 2 | Type=ext4 is not a valid service type |", "| 3 | PrivateTmp=private is not a boolean or disconnected |", "| 6 | ProtectControlGroups=nope is not a boolean, private or strict |", "| 7 | RestartSec=1.s is not a valid time span |"]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportHardening example 1", () => {
  const md = core.reportHardening("# /etc/systemd/system/web.service\n[Unit]\nDescription=Web API\nAfter=network-online.target\nRequires=postgresql.service\n\n[Service]\nType=simple\nUser=root\nExecStart=/usr/bin/node /srv/web/server.js \\\n  --port 8080\nRestart=always\nRestartSec=5x\nPrivateTmp=yes\nNoNewPrivileges=maybe\nType=notify\n\n[Install]\nWantedBy=multi-user.target\n");
  assert.equal(typeof md, 'string');
  for (const s of ["# Service Hardening", "1 of 15 hardening settings applied.", "| User | root | a non-root user or DynamicUser=yes | no |", "| NoNewPrivileges | maybe | yes | no |", "| PrivateTmp | yes | yes | yes |", "| ProtectSystem | - | strict | no |"]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportHardening example 2", () => {
  const md = core.reportHardening("[Unit]\nDescription=Nightly backup\n[Timer]\nOnCalendar=*-*-* 02:00:00\n");
  assert.equal(typeof md, 'string');
  for (const s of ["# Service Hardening", "Hardening applies to service units only."]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportHardening example 3", () => {
  const md = core.reportHardening("[Service]\nPrivateTmp=disconnected\nProtectControlGroups=private\nSystemCallFilter=@system-service\nSystemCallFilter=\nCapabilityBoundingSet=\n");
  assert.equal(typeof md, 'string');
  for (const s of ["3 of 15 hardening settings applied.", "| PrivateTmp | disconnected | yes | yes |", "| ProtectControlGroups | private | yes | yes |", "| CapabilityBoundingSet | - | only the capabilities the service needs | yes |", "| SystemCallFilter | - | @system-service | no |"]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportReliability example 1", () => {
  const md = core.reportReliability("# /etc/systemd/system/web.service\n[Unit]\nDescription=Web API\nAfter=network-online.target\nRequires=postgresql.service\n\n[Service]\nType=simple\nUser=root\nExecStart=/usr/bin/node /srv/web/server.js \\\n  --port 8080\nRestart=always\nRestartSec=5x\nPrivateTmp=yes\nNoNewPrivileges=maybe\nType=notify\n\n[Install]\nWantedBy=multi-user.target\n");
  assert.equal(typeof md, 'string');
  for (const s of ["# Reliability Check", "2 findings.", "| 4 | Network ordering | After=network-online.target without Wants=network-online.target does not pull the target in |", "| 13 | Restart delay | RestartSec=5x is not a valid time span: the default of 100 ms applies and the service may hit the start limit |"]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportReliability example 2", () => {
  const md = core.reportReliability("[Unit]\nDescription=Nightly backup\n[Timer]\nOnCalendar=*-*-* 02:00:00\n");
  assert.equal(typeof md, 'string');
  for (const s of ["2 findings.", "| 3 | Install section | no WantedBy= in [Install]: the unit cannot be enabled |", "| 4 | Missed timer runs | OnCalendar timer without Persistent=true skips runs missed while the machine was off |"]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportReliability example 3", () => {
  const md = core.reportReliability("[Unit]\nDescription=Mail relay!\nAfter=network.target\nAfter=network-online.target postgresql.service\nWants=redis.service\nWants=network-online.target\nBefore=\nBefore=mail-queue.service\n\n[Service]\nExecStart=/usr/bin/relay\nRestart=on-failure\nRestartSec=3s\n\n[Unit]\nRequires=redis.service\n\n[Install]\nWantedBy=multi-user.target\n");
  assert.equal(typeof md, 'string');
  for (const s of ["No findings."]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportReliability example 4", () => {
  const md = core.reportReliability("[Unit]\nDescription=Queue worker\n\n[Service]\nExecStart=/usr/bin/one\nExecStart=\nExecStart=/usr/bin/two\nExecStart=/usr/bin/three\nRestart=on-abnormal\nRestartSec=10x\n\n[Install]\nWantedBy=multi-user.target\n");
  assert.equal(typeof md, 'string');
  for (const s of ["2 findings.", "| 8 | Several ExecStart | only Type=oneshot may have several ExecStart= lines |", "| 10 | Restart delay | RestartSec=10x is not a valid time span: the default of 100 ms applies and the service may hit the start limit |"]) assert.ok(md.includes(s), 'missing: ' + s);
});

test("reportReliability example 5", () => {
  const md = core.reportReliability("[Unit]\nDescription=x\n[Service]\nExecStart=/bin/a\nRestart=on-success\n[Install]\nWantedBy=multi-user.target\n");
  assert.equal(typeof md, 'string');
  for (const s of ["1 finding.", "| 5 | Restart delay | no RestartSec: restarts after 100 ms and may hit the start limit |"]) assert.ok(md.includes(s), 'missing: ' + s);
});
