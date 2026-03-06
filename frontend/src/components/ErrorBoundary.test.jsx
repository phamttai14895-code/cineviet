import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary.jsx';

const Throw = () => {
  throw new Error('Test error');
};

describe('ErrorBoundary', () => {
  it('render children khi không có lỗi', () => {
    render(
      <ErrorBoundary>
        <span>Nội dung bình thường</span>
      </ErrorBoundary>
    );
    expect(screen.getByText('Nội dung bình thường')).toBeInTheDocument();
  });

  it('hiển thị UI lỗi khi component con throw', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Throw />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Đã xảy ra lỗi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tải lại trang/i })).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
