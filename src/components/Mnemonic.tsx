import { Fragment } from 'react';

import { MNEMONICS } from '../data/mnemonics';

import styles from './Mnemonic.module.css';

/**
 * Renders a mnemonic hint, highlighting the segments its author wrapped in
 * *asterisks*. Splitting on the marker leaves plain text at the even indices
 * and keywords at the odd ones.
 */
export function MnemonicLine({ hint, className }: { hint: string; className?: string }) {
  const parts = hint.split('*');
  return (
    <span className={className}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <span key={index} className={styles.key}>
            {part}
          </span>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </span>
  );
}

interface MnemonicProps {
  kana: string;
  /** `inline` drops the card chrome — used inside quiz captions. */
  variant?: 'card' | 'inline';
  className?: string;
}

/** The hint for a character, with its emoji anchor when it has one. */
export default function Mnemonic({ kana, variant = 'card', className = '' }: MnemonicProps) {
  const mnemonic = MNEMONICS[kana];
  if (!mnemonic) return null;

  if (variant === 'inline') {
    return <MnemonicLine hint={mnemonic.hint} className={`${styles.inline} ${className}`} />;
  }

  return (
    <div className={`${styles.card} ${className}`}>
      {mnemonic.emoji && (
        <span className={styles.emoji} aria-hidden="true">
          {mnemonic.emoji}
        </span>
      )}
      <MnemonicLine hint={mnemonic.hint} className={styles.text} />
    </div>
  );
}
