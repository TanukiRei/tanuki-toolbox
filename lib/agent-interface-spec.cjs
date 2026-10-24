'use strict';
// This allowlist is also the machine-readable contract returned to Agents.
const operations=[
 ['GET','/v1/status','Runtime versions, paths, component and desktop-adapter availability.'],
 ['GET','/v1/operations','Read this protocol and request shapes.'],
 ['GET','/v1/plugins','List native plugin entries and installed/catalog bundles.'],
 ['GET','/v1/settings','Read Toolbox settings (no account/model credentials).'],
 ['GET','/v1/appearance','Read the native theme preference and revision, without other settings.'],
 ['PATCH','/v1/appearance','Save the native theme preference with revision checks.',{preference:'light, dark, or system',revision:'optional integer from GET /v1/appearance'}],
 ['PATCH','/v1/settings','Update Toolbox preferences.',{island:'optional: volume, categories, bubbles, inApp, systemNotifications, soundEnabled',composer:'optional: timeStats, modelSelection, fileMenu, sessionList',settingsEnhancements:'optional: models',startup:'optional: protection; exactly one section per request'}],
 ['GET','/v1/logs','Recent API action metadata; never authorization headers or request bodies.'],
 ['GET','/v1/jobs/{requestId}','Read a durable mutation receipt.'],
 ['POST','/v1/plugins/enable','Enable/disable an entry using its native entryId.',{entryId:'string',enabled:'boolean'}],
 ['POST','/v1/bundles/enable','Select/deselect an installed bundle.',{name:'string',enabled:'boolean'}],
 ['POST','/v1/plugins/inspect','Inspect a package before installation.',{spec:'package, GitHub URL, or absolute local .tgz path'}],
 ['POST','/v1/plugins/install','Install/update through the native package manager; no script approval bypass.',{spec:'string',enabled:'optional boolean (default true)'}],
 ['POST','/v1/plugins/remove','Uninstall through the native package manager.',{name:'string'}],
 ['POST','/v1/reload','Reconcile the saved profile and reload supported plugins. Reports when restart is required.',{}],
 ['GET','/v1/desktop/status','Ask the native main process for task/admission status; launches one background IPC sender.'],
 ['POST','/v1/desktop/quit','Gracefully quit only when no active tasks or package operations exist.',{allowScheduled:'optional boolean (default false)'}],
 ['POST','/v1/desktop/restart','Gracefully restart only when no active tasks or package operations exist.',{}]
].map(([method,path,description,body])=>({method,path,description,...(body?{body}:{})}));
module.exports={protocol:1,transport:'HTTP JSON on 127.0.0.1 only',authentication:'Authorization: Bearer <key>; never use a query-string key. Browser Origin/Sec-Fetch requests are refused.',mutations:'All PATCH/POST require X-Request-ID: a fresh UUID. Returns HTTP 202 + requestId and job URL. Poll that job. Reusing the same ID and payload returns its existing receipt; a different payload returns 409. Never blindly retry with a new ID.',disabled:'The listener and existing sockets are closed on disable. Saved address/key remain valid on re-enable. Already accepted file/package transactions may finish safely. A disabled component cannot be enabled through this API.',receipts:'The latest 200 jobs are kept in profile/.tanuki-toolbox/agent-interface/jobs. If self-update/disable/quit disconnects HTTP, inspect that receipt with local file tools; reconnect after enabling/restarting. Never interpret a disconnect as success.',scope:'Structured operations only. No eval, shell execution, arbitrary HTTP forwarding, account-secret export or task submission. For source edits use your own local file tools and the returned paths, then package/install/reload. Native compatibility and management-required restrictions remain in effect.',operations};
