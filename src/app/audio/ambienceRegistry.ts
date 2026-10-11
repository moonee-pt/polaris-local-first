/** 每个音效引擎把自己的 stop 注册进来，方便一处统一静音。 */
type AmbienceStop = () => void;

const stops = new Set<AmbienceStop>();

export function registerAmbienceStop(stop: AmbienceStop): () => void {
  stops.add(stop);
  return () => {
    stops.delete(stop);
  };
}

/** 只停别的引擎，保留调用者自己那一路音效。 */
export function stopOtherAmbiences(except: AmbienceStop) {
  for (const stop of Array.from(stops)) {
    if (stop !== except) stop();
  }
}

/** 全部静音：离开世界、切换对话等场合。 */
export function stopAllAmbiences() {
  for (const stop of Array.from(stops)) stop();
}
