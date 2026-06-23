import type { AdminOperationalState, RpcResult } from "../core/types";
import { normalizeAdminState } from "../core/adminState";

const requestedPublishHashStorageKey = "el-faraon-admin-requested-publish-hash";
const publishCooldownStorageKey = "el-faraon-admin-publish-cooldown-ends-at";
const defaultPublishCooldownSeconds = 60;

export function createAdminPublicationState(deployedContentHash: string) {
  let requestedPublishHash = readRequestedPublishHash();
  let publishCooldownEndsAt = readPublishCooldownEndsAt();

  function getRequestedPublishHash(): string {
    return requestedPublishHash;
  }

  function markCurrentPublicationRequested(state: AdminOperationalState | null): void {
    const contentHash = state?.publication.current_content_hash;

    if (!contentHash) {
      return;
    }

    requestedPublishHash = contentHash;
    window.sessionStorage.setItem(requestedPublishHashStorageKey, contentHash);
  }

  function rememberPublishCooldown(result: RpcResult): void {
    const seconds = result.cooldown_seconds_remaining
      ?? (result.message === "publish_queued" ? defaultPublishCooldownSeconds : 0);

    if (typeof seconds !== "number" || !Number.isSafeInteger(seconds) || seconds <= 0) {
      return;
    }

    publishCooldownEndsAt = Date.now() + (seconds * 1000);
    window.localStorage.setItem(publishCooldownStorageKey, String(publishCooldownEndsAt));
  }

  function getCooldownSecondsRemaining(): number {
    const millisecondsRemaining = publishCooldownEndsAt - Date.now();

    if (millisecondsRemaining <= 0) {
      publishCooldownEndsAt = 0;
      window.localStorage.removeItem(publishCooldownStorageKey);
      return 0;
    }

    return Math.ceil(millisecondsRemaining / 1000);
  }

  function reconcileState(state: AdminOperationalState): AdminOperationalState {
    if (!requestedPublishHash) {
      return state;
    }

    const currentContentHash = state.publication.current_content_hash;
    const activeDeployedContentHash = state.publication.deployed_content_hash;

    if (requestedPublishHash === currentContentHash && requestedPublishHash !== activeDeployedContentHash) {
      return state;
    }

    requestedPublishHash = "";
    window.sessionStorage.removeItem(requestedPublishHashStorageKey);
    return normalizeAdminState(state, deployedContentHash, requestedPublishHash);
  }

  return {
    getCooldownSecondsRemaining,
    getRequestedPublishHash,
    markCurrentPublicationRequested,
    reconcileState,
    rememberPublishCooldown,
  };
}

function readRequestedPublishHash(): string {
  return window.sessionStorage.getItem(requestedPublishHashStorageKey) ?? "";
}

function readPublishCooldownEndsAt(): number {
  const value = Number(window.localStorage.getItem(publishCooldownStorageKey));
  return Number.isSafeInteger(value) && value > Date.now() ? value : 0;
}
