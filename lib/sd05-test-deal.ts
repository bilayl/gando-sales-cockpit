export const FORTUNEO_TEST_ROOM_ID = "e7ecbdc7-a54b-4309-8265-ac5443909235";

export function isFortuneoTestResignRoom(roomId?: string | null) {
  return String(roomId || "") === FORTUNEO_TEST_ROOM_ID;
}
