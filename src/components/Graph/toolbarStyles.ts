import type { CSSProperties } from 'react';
import { C } from './constants';

export const toolbarStackStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  pointerEvents: 'none',
};

export const toolbarRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: 6,
  padding: 4,
  background: C.bgPanel,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
  pointerEvents: 'auto',
};

export const toolbarGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

export const toolbarDividerStyle: CSSProperties = {
  width: 1,
  alignSelf: 'stretch',
  background: C.border,
  margin: '4px 4px',
};

export const toolbarButtonBaseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 12px',
  borderRadius: 7,
  border: 'none',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.01em',
  lineHeight: 1.2,
  transition: 'all 0.15s',
};
