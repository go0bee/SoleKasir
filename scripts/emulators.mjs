import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
const require=createRequire(import.meta.url)
const env={...process.env}
// MSIX Windows environments may redirect the JDK Unix-domain pipe directory.
// Keep this adjustment local to the emulator process; do not change system Java settings.
if(process.platform==='win32'){
 const directory=resolve('artifacts/java-tmp');mkdirSync(directory,{recursive:true})
 env.JAVA_TOOL_OPTIONS=[env.JAVA_TOOL_OPTIONS,`-Djdk.net.unixdomain.tmpdir="${directory}"`].filter(Boolean).join(' ')
}
const testing=process.argv[2]==='test'
const args=[testing?'emulators:exec':'emulators:start','--project','demo-solekasir','--only','auth,firestore']
if(testing)args.push('vitest run tests/rules.test.ts tests/integration.test.ts tests/subscriptions-invoices.test.ts tests/auth-integration.test.ts')
const child=spawn(process.execPath,[require.resolve('firebase-tools/lib/bin/firebase.js'),...args],{env,stdio:'inherit'})
child.on('error',error=>{console.error(error.message);process.exitCode=1})
child.on('exit',code=>{process.exitCode=code??1})

