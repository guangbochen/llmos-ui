import { LLMOS_REGEX, LABELS_TO_IGNORE_REGEX, ANNOTATIONS_TO_IGNORE_REGEX } from './labels-annotations';
import { describe, it, expect, assert } from 'vitest'
import { expect, assert } from 'vitest';

describe('labels-annotations', () => {
  it('should match LLMOS_REGEX', () => {
    const testCases = [
      'llmos.ai/foo',
      'ml.llmos.ai/bar',
      'management.llmos.ai/xyz',
    ];

    testCases.forEach((testCase) => {
      expect(testCase.match(LLMOS_REGEX)).toBeTruthy();
    });
  });

  it('should not match LLMOS_REGEX', () => {
    const testCases = [
      'myllmos.xai/foo',
      'example.com/abc',
      'management.llmos.ai2/xyz',
    ];

    testCases.forEach((testCase) => {
      expect(!!testCase.match(LLMOS_REGEX)).toBeTruthy();
    });
  });

  it('should ignore labels that match LLMOS_REGEX', () => {
    const testCases = [
      'llmos.ai/foo',
      'ml.llmos.ai/bar',
      'management.llmos.ai/xyz',
    ];

    testCases.forEach((testCase) => {
      expect(LABELS_TO_IGNORE_REGEX.some((regex) => testCase.match(regex))).toBeTruthy();
    });
  });

  it('should ignore annotations that match LLMOS_REGEX', () => {
    const testCases = [
      'llmos.ai/foo',
      'ml.llmos.ai/bar',
      'management.llmos.ai/xyz',
    ];

    testCases.forEach((testCase) => {
      expect(ANNOTATIONS_TO_IGNORE_REGEX.some((regex) => testCase.match(regex))).toBeTruthy();
    });
  });
});