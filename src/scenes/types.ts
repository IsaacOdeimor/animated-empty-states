import type { ComponentType } from 'react';

export interface SceneContent {
  title: string;
  subtitle: string;
  copy: string;
  action: string;
  /** accessible description of the illustration */
  artLabel: string;
}

export interface SceneDef {
  id: string;
  /** frames (60 fps) in one pass of the timeline; the last frame matches frame 0 */
  duration: number;
  /** pose shown for prefers-reduced-motion */
  staticFrame: number;
  Art: ComponentType<{ f: number }>;
  content: SceneContent;
}
