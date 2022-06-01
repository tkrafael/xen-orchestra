import NbdClient from './client.mjs'
import { Xapi } from 'xen-api'
import readline from 'node:readline'
import { stdin as input, stdout as output } from 'node:process'
import { asyncMap } from '@xen-orchestra/async-map'
import { asyncEach } from '@vates/async-each'

const xapi = new Xapi({
  auth: {
    user: 'root',
    password: 'vateslab',
  },
  url: '172.16.210.11',
  allowUnauthorized: true,
})
await xapi.connect()

const rl = readline.createInterface({ input, output })
const question = text => {
  return new Promise(resolve => {
    rl.question(text, resolve)
  })
}

let vmuuid, vmRef
do {
  vmuuid = await question('VM uuid ? ')
  try {
    vmRef = await xapi.getObject(vmuuid).$ref
  } catch (e) {
    console.log(e)
    console.log('maybe the objects was not loaded, try again ')
  }
} while (!vmRef)

const vdiRefs = (
  await asyncMap(await xapi.call('VM.get_VBDs', vmRef), async vbd => {
    const vdi = await xapi.call('VBD.get_VDI', vbd)
    return vdi
  })
).filter(vdiRef => vdiRef !== 'OpaqueRef:NULL')

const vdiRef = vdiRefs[0]

const vdi = await xapi.getObject(vdiRef)

const [nbd, ..._] = await xapi.call('VDI.get_nbd_info', vdiRef)

if (!nbd) {
  console.error('Nbd is not enabled on the host')
  console.error('you should add `insecure_nbd` as the `purpose` of a network of this host')
  process.exit()
}
console.log('Will work on vdi  [', vdi.name_label, ']')
const cbt_enabled = vdi.cbt_enabled
console.log('Change block tracking is [', cbt_enabled ? 'enabled' : 'disabled', ']')

if (!cbt_enabled) {
  const shouldEnable = await question('would you like to enable it ? Y/n ')
  if (shouldEnable === 'Y') {
    await xapi.call('VDI.enable_cbt', vdiRef)
    console.log('CBT is now enable for this VDI')
    console.log('You must make a snapshot, write some data and relaunch this script to backup changes')
  } else {
    console.warn('did nothing')
  }
  process.exit()
}

console.log('will search for suitable snapshots')
const snapshots = (await asyncMap(vdi.snapshots, async snapshotRef => xapi.getObject(snapshotRef))).filter(
  ({ cbt_enabled }) => cbt_enabled
)

if (snapshots.length < 2) {
  console.error(`not enough snapshots with cbt enabled , found ${snapshots.length} and 2 are needed`)
}

let refSnapshotQuestion = 'Which snapshot will be the reference one ?'
for (const index in snapshots) {
  refSnapshotQuestion += '\n' + (parseInt(index) + 1) + ':' + snapshots[index].snapshot_time
}

const refSnapshotIndex = await question(refSnapshotQuestion + '\n')

let recentSnapshotQuestion = 'Which snapshot will be the most recent one ?'
for (const index in snapshots) {
  recentSnapshotQuestion += '\n' + (parseInt(index) + 1) + ':' + snapshots[index].snapshot_time
}
const recentSnapshotIndex = await question(recentSnapshotQuestion + '\n')

console.log('will get bitmap of changed blocks')
const cbt = Buffer.from(
  await xapi.call(
    'VDI.list_changed_blocks',
    await xapi.getObject(snapshots[refSnapshotIndex - 1].uuid).$ref,
    await xapi.getObject(snapshots[recentSnapshotIndex - 1].uuid).$ref
  )
)
console.log('got it')

console.log('will connect to NBD server')
const client = new NbdClient(nbd)
await client.connect()

let nbModified = 0
const start = new Date()

const MASK = 0x80
const test = (map, bit) => ((map[bit >> 3] << (bit & 7)) & MASK) !== 0
const changed = []
for (let i = 0; i < cbt.length * 8; i++) {
  if (test(cbt, i)) {
    changed.push(i)
  }
}
console.log(changed.length, 'block changed')
await asyncEach(
  changed,
  async blockIndex => {
    console.log('will read', blockIndex)
    await client.readBlock(blockIndex)
    console.log('read', blockIndex)
    nbModified++
  },
  {
    concurrency: 4,
  }
)

console.log('duration :', new Date() - start)
console.log('modified blocks : ', nbModified)
