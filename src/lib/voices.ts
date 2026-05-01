export type VoiceGender = "female" | "male";

export interface Voice {
  id: string;
  label: string;
  gender: VoiceGender;
}

export const VOICES: Voice[] = [
  { id: "Aoede",  label: "Aoede",  gender: "female" },
  { id: "Kore",   label: "Kore",   gender: "female" },
  { id: "Puck",   label: "Puck",   gender: "male"   },
  { id: "Charon", label: "Charon", gender: "male"   },
];

export const DEFAULT_VOICE_ID = "Aoede";
