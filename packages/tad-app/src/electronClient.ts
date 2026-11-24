import { TransportClient } from "reltab";
import { tadApi } from "./tadApi";

// TODO: Exception handling!
export class ElectronTransportClient implements TransportClient {
  invoke(functionName: string, req: any): Promise<any> {
    // MUC hardening: goes through the allow-listed preload bridge
    return tadApi.invoke(functionName, req);
  }
}
