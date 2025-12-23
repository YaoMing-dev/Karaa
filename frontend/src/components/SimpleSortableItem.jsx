import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * SimpleSortableItem - COPIED FROM DragTestSimple
 * Drag handle completely separate from content
 */
const SimpleSortableItem = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    padding: '8px 8px 8px 48px',
    margin: '8px 0',
    backgroundColor: isDragging ? '#f0f9ff' : 'transparent',
    border: isDragging ? '2px dashed #3b82f6' : '2px solid transparent',
    borderRadius: '8px',
    opacity: isDragging ? 0.7 : 1,
    minHeight: '40px',
  };

  const handleStyle = {
    position: 'absolute',
    left: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '28px',
    height: '60%',
    minHeight: '32px',
    maxHeight: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.9)',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'grab',
    touchAction: 'none',
    userSelect: 'none',
    zIndex: 999,
    pointerEvents: 'auto',
    opacity: 0.6,
    transition: 'opacity 0.2s, background 0.2s, border-color 0.2s',
  };

  const handleActiveStyle = {
    ...handleStyle,
    cursor: 'grabbing',
    background: '#e0e7ff',
    borderColor: '#4f46e5',
    opacity: 1,
  };

  const handleHoverStyle = {
    opacity: 1,
    background: '#ffffff',
    borderColor: '#9ca3af',
  };

  const [isHovering, setIsHovering] = React.useState(false);

  return (
    <div ref={setNodeRef} style={style}>
      {/* DRAG HANDLE */}
      <div
        ref={setActivatorNodeRef}
        style={isDragging ? handleActiveStyle : isHovering ? { ...handleStyle, ...handleHoverStyle } : handleStyle}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        title="Drag to reorder"
        aria-label="Drag handle"
        role="button"
        {...attributes}
        {...listeners}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="5" cy="4" r="1.5" fill={isDragging ? '#4f46e5' : '#9CA3AF'}/>
          <circle cx="11" cy="4" r="1.5" fill={isDragging ? '#4f46e5' : '#9CA3AF'}/>
          <circle cx="5" cy="8" r="1.5" fill={isDragging ? '#4f46e5' : '#9CA3AF'}/>
          <circle cx="11" cy="8" r="1.5" fill={isDragging ? '#4f46e5' : '#9CA3AF'}/>
          <circle cx="5" cy="12" r="1.5" fill={isDragging ? '#4f46e5' : '#9CA3AF'}/>
          <circle cx="11" cy="12" r="1.5" fill={isDragging ? '#4f46e5' : '#9CA3AF'}/>
        </svg>
      </div>

      {/* CONTENT */}
      {children}
    </div>
  );
};

export default SimpleSortableItem;
