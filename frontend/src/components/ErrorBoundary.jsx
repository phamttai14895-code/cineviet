import React from 'react';

/**
 * Error Boundary: bắt lỗi render trong cây con, tránh sập toàn bộ app.
 * Hiển thị UI thay thế và nút "Tải lại trang".
 */
export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (typeof window !== 'undefined' && window.console) {
      console.error('[ErrorBoundary]', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary-content">
            <h1 className="error-boundary-title">Đã xảy ra lỗi</h1>
            <p className="error-boundary-message">
              Trang tạm thời gặp sự cố. Bạn có thể thử tải lại trang hoặc quay lại trang chủ.
            </p>
            <div className="error-boundary-actions">
              <button type="button" className="btn btn-primary" onClick={this.handleRetry}>
                Thử lại
              </button>
              <button type="button" className="btn btn-secondary" onClick={this.handleReload}>
                Tải lại trang
              </button>
              <a href="/" className="btn btn-outline">
                Về trang chủ
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
