import type {
  Router,
  Transport,
  Producer,
  Consumer,
  DataProducer,
  DataConsumer,
} from "mediasoup/types";

export interface RoomPeer {
  id: string;
  transports: Transport[];
  producers: Producer[];
  consumers: Consumer[];
  dataProducers: DataProducer[];
  dataConsumers: DataConsumer[];
  screenShareProducer?: Producer;
  micActive: boolean;
  camActive: boolean;
  isShareScreen: boolean;
}

export class Room {
  public peers: Map<string, RoomPeer> = new Map();
  constructor(public id: string, public router: Router) {}

  addPeer(peerId: string) {
    if (!this.peers.has(peerId)) {
      this.peers.set(peerId, {
        id: peerId,
        transports: [],
        producers: [],
        consumers: [],
        dataProducers: [],
        dataConsumers: [],
        micActive: true,
        camActive: true,
        isShareScreen: false,
      });
    }
    return this.peers.get(peerId)!;
  }

  getProducers() {
    return Array.from(this.peers.values()).flatMap((peer) =>
      peer.producers.map((producer) => ({
        userId: peer.id,
        producerId: producer.id,
        kind: producer.kind,
      }))
    );
  }

  getScreenShareProducers() {
    return Array.from(this.peers.values())
      .filter((peer) => peer.screenShareProducer)
      .map((peer) => ({
        userId: peer.id,
        producerId: peer.screenShareProducer!.id,
        kind: peer.screenShareProducer!.kind,
        appData: peer.screenShareProducer!.appData,
      }));
  }

  addScreenShareProducer(peerId: string, producer: Producer) {
    const peer = this.getPeer(peerId);
    if (peer) {
      peer.screenShareProducer = producer;
      return true;
    }
    return false;
  }

  removeScreenShareProducer(peerId: string) {
    const peer = this.getPeer(peerId);
    if (peer && peer.screenShareProducer) {
      peer.screenShareProducer = undefined;
      return true;
    }
    return false;
  }

  hasActiveScreenShare() {
    return Array.from(this.peers.values()).some(
      (peer) => peer.screenShareProducer
    );
  }

  getPeer(peerId: string) {
    return this.peers.get(peerId);
  }

  removePeer(peerId: string) {
    this.peers.delete(peerId);
  }
}
