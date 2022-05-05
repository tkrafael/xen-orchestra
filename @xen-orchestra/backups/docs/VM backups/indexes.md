## How listing available backups works?

1. listing all VMs in `xo-vm-backups`
2. listing all JSON files in a VM dir
3. reading a JSON file

## Cache all backups for a specific VM

It will improve steps 2 and 3.

Add the following file: `xo-vm-backups/<VM UUID>/cache.json.gz`.

With the following structure:

```json
{
  [backupJsonFile]: backupJsonContent
}
```

### Generation

On demand in `RemoteAdapter#listVmBackups`.

It should be properly synchronized with `handler.lock(vmBackupDir/cache.json.gz)`:

- if missing: acquire lock
- when lock acquired: retry reading it and if missing, generates it

### Invalidation

The cache should be deleted after:

- creating a backup (`MixinBackupWriter#afterBackup`)
- deleting a backup (`RemoteAdapter#deleteDeltaVmBackups` & `RemoteAdapter#deleteFullVmBackups`)
