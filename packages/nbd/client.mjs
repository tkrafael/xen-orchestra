import assert from 'node:assert'
import { Socket } from 'node:net'

export default class NbdClient {
  #address
  #cert
  #exportname
  #port
  #client
  #buffer = Buffer.alloc(0)
  #readPromiseResolve
  #waitingForLength = 0
  #nbDiskBlocks = 0
  constructor({ address, port = 10809, exportname, cert }) {
    this.#address = address
    this.#port = port
    this.#exportname = exportname
    this.#cert = cert
    this.#client = new Socket()
  }

  async connect() {
    const client = this.#client
    return new Promise(resolve => {
      client.connect(this.#port, this.#address, async () => {
        await this.#handshake()
        resolve()
      })

      client.on('data', data => {
        this.#buffer = Buffer.concat([this.#buffer, Buffer.from(data)])

        if (this.#readPromiseResolve && this.#buffer.length >= this.#waitingForLength) {
          this.#readPromiseResolve(this.#takeFromBuffer(this.#waitingForLength))
          this.#readPromiseResolve = null
          this.#waitingForLength = 0
        }
      })

      client.on('close', function () {
        console.log('Connection closed')
      })
      client.on('error', function (err) {
        console.error('ERRROR', err)
      })
    })
  }

  async #handshake() {
    assert(await this.#readFromSocket(8), 'NBDMAGIC')
    assert(await this.#readFromSocket(8), 'IHAVEOPT')
    const flagsBuffer = await this.#readFromSocket(2)
    const flags = flagsBuffer.readInt16BE(0)
    assert(flags === 1) // only FIXED_NEWSTYLE one is supported
    await this.#writeToSocketInt32(1) //client also support  NBD_FLAG_C_FIXED_NEWSTYLE

    // send export name it's also implictly closing the negociation phase
    await this.#writeToSocket(Buffer.from('IHAVEOPT'))
    await this.#writeToSocketInt32(1) //command NBD_OPT_EXPORT_NAME
    await this.#writeToSocketInt32(this.#exportname.length)
    await this.#writeToSocket(Buffer.from(this.#exportname))
    // 8 + 2 + 124
    const answer = await this.#readFromSocket(134)
    const exportSize = answer.readBigUInt64BE(0)
    const transmissionFlags = answer.readInt16BE(8) // 3 is readonly
    this.#nbDiskBlocks = Number(exportSize / BigInt(64 * 1024))
    console.log(`disk is ${exportSize} bytes`)
  }

  #takeFromBuffer(length) {
    const res = Buffer.from(this.#buffer.slice(0, length))
    this.#buffer = this.#buffer.slice(length)
    return res
  }

  #readFromSocket(length) {
    if (this.#buffer.length >= length) {
      return this.#takeFromBuffer(length)
    }
    return new Promise(resolve => {
      this.#readPromiseResolve = resolve
      this.#waitingForLength = length
    })
  }

  #writeToSocket(buffer) {
    return new Promise(resolve => {
      this.#client.write(buffer, resolve)
    })
  }

  async #readFromSocketInt32() {
    const buffer = await this.#readFromSocket(4)

    return buffer.readInt32BE(0)
  }

  async #readFromSocketInt64() {
    const buffer = await this.#readFromSocket(8)
    return buffer.readBigUInt64BE(0)
  }

  #writeToSocketInt32(int) {
    const buffer = Buffer.alloc(4)
    buffer.writeInt32BE(int)
    return this.#writeToSocket(buffer)
  }
  #writeToSocketUInt32(int) {
    const buffer = Buffer.alloc(4)
    buffer.writeUInt32BE(int)
    return this.#writeToSocket(buffer)
  }

  #writeToSocketInt16(int) {
    const buffer = Buffer.alloc(2)
    buffer.writeInt16BE(int)
    return this.#writeToSocket(buffer)
  }
  #writeToSocketInt64(int) {
    const buffer = Buffer.alloc(8)
    buffer.writeBigUInt64BE(BigInt(int))
    return this.#writeToSocket(buffer)
  }

  async getChangedBlockTracking(vdiFrom, vdiTo) {
    //
  }

  async readBlock(index) {
    const start = new Date()
    //this.#buffer = Buffer.alloc(0)=
    const BLOCK_SIZE = 64 * 1024
    const handle = BigInt(Math.floor(Math.random() * BLOCK_SIZE))
    await this.#writeToSocketInt32(0x25609513) //NBD_REQUEST MAGIC
    await this.#writeToSocketInt16(0) //command flags
    await this.#writeToSocketInt16(0) //READ
    await this.#writeToSocketInt64(handle)
    await this.#writeToSocketInt64(BigInt(index) * BigInt(BLOCK_SIZE))
    await this.#writeToSocketUInt32(BLOCK_SIZE)

    //NBD_SIMPLE_REPLY_MAGIC
    const magic = await this.#readFromSocketInt32()

    if (magic !== 0x67446698) {
      console.error('magic number for block answer is wrong : ', magic)
      return
    }
    // error
    const error = await this.#readFromSocketInt32()
    if (error !== 0) {
      console.error('GOT ERROR CODE ', error)
      return
    }
    // handle
    const handleAnswer = await this.#readFromSocketInt64()
    //assert(handleAnswer, handle) // handle did not changed
    // data
    return await this.#readFromSocket(BLOCK_SIZE)
  }

  async *getChangedBlock(changedBlocks) {
    const MASK = 0x80
    const test = (map, bit) => ((map[bit >> 3] << (bit & 7)) & MASK) !== 0
    console.log('getChangedBlock', changedBlocks.length * 8, this.#nbDiskBlocks)
    let blockIndex = 0
    for (let i = 0; i < this.#nbDiskBlocks; i++) {
      if (changedBlocks.readUInt8(Math.floor(i / 8)) !== 65 && test(changedBlocks, i)) {
        //console.log('change in ',blockIndex)
        console.log(i, changedBlocks.readUInt8(Math.floor(i / 8)), i % 8)
        const data = await this.readBlock(blockIndex)
        yield {
          index: blockIndex,
          data,
        }
        /*const data = await this.readBlock(blockIndex)
        yield {
          index: blockIndex,
          data
        }*/
      } else {
        //  console.log('.')
      }
      blockIndex++
    }
    /*
    for(let byteIndex =0; byteIndex < changedBlocks.length; byteIndex++ ){
      const byte = changedBlocks.readUInt8(byteIndex)

      for(let bitIndex = 0;  bitIndex < 8; bitIndex ++){
        if(test(changedBlocks,byteIndex*8 +  bitIndex)){
          //console.log('change in ',blockIndex)
          console.log(byteIndex*8 +  bitIndex, byte, bitIndex, byte>>bitIndex, (byte>>bitIndex) % 2)

          const data = await this.readBlock(blockIndex)
          yield {
            index: blockIndex,
            data
          }
        }
        blockIndex ++
      }
    }*/
    console.log('total blocks ', blockIndex)
  }
}
