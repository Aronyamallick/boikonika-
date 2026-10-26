import { parseMarkdown, spacing, type MdBlock, type MdInline } from '@boikonika/shared';
import type { ReactNode } from 'react';
import { Text as RNText, View } from 'react-native';
import { openLink } from '@/lib/links';
import { useTheme } from '@/lib/theme';
import { Text } from './ui';

/**
 * Staff-written Markdown (pages, articles, FAQ answers) from the shared parser, which returns a tree —
 * never HTML — so the text can't inject anything. Links open in the app when it has the screen.
 */
export function Markdown({ source }: { source: string | null | undefined }) {
  return <View style={{ gap: spacing[3] }}>{parseMarkdown(source).map((b, i) => <Block key={i} block={b} />)}</View>;
}

function Block({ block: b }: { block: MdBlock }) {
  const { c } = useTheme();
  switch (b.type) {
    case 'heading':
      return (
        <Text accessibilityRole="header" size={b.level === 2 ? 'xl' : 'lg'} weight="bold" style={{ marginTop: spacing[2] }}>
          <Inline nodes={b.children} />
        </Text>
      );
    case 'paragraph':
      return (
        <Text>
          <Inline nodes={b.children} />
        </Text>
      );
    case 'list':
      return (
        <View style={{ gap: spacing[1] }} accessibilityRole="list">
          {b.items.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing[2] }}>
              <Text tone="subtle">{b.ordered ? `${b.start + i}.` : '•'}</Text>
              <Text style={{ flex: 1 }}>
                <Inline nodes={item} />
              </Text>
            </View>
          ))}
        </View>
      );
    case 'quote':
      return (
        <View style={{ borderLeftWidth: 4, borderLeftColor: c.primary, backgroundColor: c.bgSubtle, paddingVertical: spacing[2], paddingHorizontal: spacing[3], gap: spacing[2] }}>
          {b.children.map((child, i) => (
            <Block key={i} block={child} />
          ))}
        </View>
      );
    case 'rule':
      return <View style={{ height: 1, backgroundColor: c.border, marginVertical: spacing[3] }} />;
  }
}

function Inline({ nodes }: { nodes: MdInline[] }): ReactNode {
  const { c } = useTheme();
  return nodes.map((n, i) => {
    switch (n.type) {
      case 'text':
        return n.text;
      case 'break':
        return '\n';
      case 'strong':
        return (
          <RNText key={i} style={{ fontWeight: '600' }}>
            <Inline nodes={n.children} />
          </RNText>
        );
      case 'em':
        return (
          <RNText key={i} style={{ fontStyle: 'italic' }}>
            <Inline nodes={n.children} />
          </RNText>
        );
      case 'code':
        return (
          <RNText key={i} style={{ fontFamily: 'monospace', backgroundColor: c.bgSubtle }}>
            {n.text}
          </RNText>
        );
      case 'link':
        return (
          <RNText key={i} accessibilityRole="link" style={{ color: c.primary, textDecorationLine: 'underline' }} onPress={() => void openLink(n.href)}>
            <Inline nodes={n.children} />
          </RNText>
        );
    }
  });
}
