import { MutableRefObject, useCallback, useRef } from 'react';
import Konva from 'konva';
import { Layer, Stage } from 'react-konva';
import { Stage as StageType } from 'konva/lib/Stage';
import { useAppSelector } from 'app/store';
import {
  initialCanvasImageSelector,
  canvasSelector,
  isStagingSelector,
  shouldLockToInitialImageSelector,
} from 'features/canvas/store/canvasSelectors';
import IAICanvasMaskLines from './IAICanvasMaskLines';
import IAICanvasBrushPreview from './IAICanvasBrushPreview';
import { Vector2d } from 'konva/lib/types';
import IAICanvasBoundingBox from './IAICanvasToolbar/IAICanvasBoundingBox';
import useCanvasHotkeys from '../hooks/useCanvasHotkeys';
import _ from 'lodash';
import { createSelector } from '@reduxjs/toolkit';
import { activeTabNameSelector } from 'features/options/optionsSelectors';
import IAICanvasMaskCompositer from './IAICanvasMaskCompositer';
import useCanvasWheel from '../hooks/useCanvasZoom';
import useCanvasMouseDown from '../hooks/useCanvasMouseDown';
import useCanvasMouseUp from '../hooks/useCanvasMouseUp';
import useCanvasMouseMove from '../hooks/useCanvasMouseMove';
import useCanvasMouseEnter from '../hooks/useCanvasMouseEnter';
import useCanvasMouseOut from '../hooks/useCanvasMouseOut';
import useCanvasDragMove from '../hooks/useCanvasDragMove';
import IAICanvasObjectRenderer from './IAICanvasObjectRenderer';
import IAICanvasGrid from './IAICanvasGrid';
import IAICanvasIntermediateImage from './IAICanvasIntermediateImage';
import IAICanvasStatusText from './IAICanvasStatusText';
import IAICanvasStagingArea from './IAICanvasStagingArea';
import IAICanvasStagingAreaToolbar from './IAICanvasStagingAreaToolbar';

const selector = createSelector(
  [
    shouldLockToInitialImageSelector,
    canvasSelector,
    isStagingSelector,
    activeTabNameSelector,
    initialCanvasImageSelector,
  ],
  (
    shouldLockToInitialImage,
    canvas,
    isStaging,
    activeTabName,
    initialCanvasImage
  ) => {
    const {
      isMaskEnabled,
      stageScale,
      shouldShowBoundingBox,
      isTransformingBoundingBox,
      isMouseOverBoundingBox,
      isMovingBoundingBox,
      stageDimensions,
      stageCoordinates,
      tool,
      isMovingStage,
      shouldShowIntermediates,
      shouldShowGrid,
    } = canvas;

    let stageCursor: string | undefined = '';

    if (tool === 'move' || isStaging) {
      if (isMovingStage) {
        stageCursor = 'grabbing';
      } else {
        stageCursor = 'grab';
      }
    } else if (isTransformingBoundingBox) {
      stageCursor = undefined;
    } else if (isMouseOverBoundingBox) {
      stageCursor = 'move';
    } else {
      stageCursor = 'none';
    }

    return {
      isMaskEnabled,
      isModifyingBoundingBox: isTransformingBoundingBox || isMovingBoundingBox,
      shouldShowBoundingBox,
      shouldShowGrid,
      stageCoordinates,
      stageCursor,
      stageDimensions,
      stageScale,
      tool,
      isStaging,
      shouldShowIntermediates,
      shouldLockToInitialImage,
      initialCanvasImage,
    };
  },
  {
    memoizeOptions: {
      resultEqualityCheck: _.isEqual,
    },
  }
);

// Use a closure allow other components to use these things... not ideal...
export let stageRef: MutableRefObject<StageType | null>;
export let canvasImageLayerRef: MutableRefObject<Konva.Layer | null>;

const IAICanvas = () => {
  const {
    isMaskEnabled,
    isModifyingBoundingBox,
    shouldShowBoundingBox,
    shouldShowGrid,
    stageCoordinates,
    stageCursor,
    stageDimensions,
    stageScale,
    tool,
    isStaging,
    shouldShowIntermediates,
    shouldLockToInitialImage,
    initialCanvasImage,
  } = useAppSelector(selector);
  useCanvasHotkeys();

  // set the closure'd refs
  stageRef = useRef<StageType>(null);
  canvasImageLayerRef = useRef<Konva.Layer>(null);

  const lastCursorPositionRef = useRef<Vector2d>({ x: 0, y: 0 });

  // Use refs for values that do not affect rendering, other values in redux
  const didMouseMoveRef = useRef<boolean>(false);

  const handleWheel = useCanvasWheel(stageRef);
  const handleMouseDown = useCanvasMouseDown(stageRef);
  const handleMouseUp = useCanvasMouseUp(stageRef, didMouseMoveRef);
  const handleMouseMove = useCanvasMouseMove(
    stageRef,
    didMouseMoveRef,
    lastCursorPositionRef
  );
  const handleMouseEnter = useCanvasMouseEnter(stageRef);
  const handleMouseOut = useCanvasMouseOut();
  const { handleDragStart, handleDragMove, handleDragEnd } =
    useCanvasDragMove();

  const dragBoundFunc = useCallback(
    (newCoordinates: Vector2d) => {
      if (shouldLockToInitialImage && initialCanvasImage) {
        newCoordinates.x = _.clamp(
          newCoordinates.x,
          stageDimensions.width -
            Math.floor(initialCanvasImage.width * stageScale),
          0
        );
        newCoordinates.y = _.clamp(
          newCoordinates.y,
          stageDimensions.height -
            Math.floor(initialCanvasImage.height * stageScale),
          0
        );
      }

      return newCoordinates;
    },
    [
      initialCanvasImage,
      shouldLockToInitialImage,
      stageDimensions.height,
      stageDimensions.width,
      stageScale,
    ]
  );

  return (
    <div className="inpainting-canvas-container">
      <div className="inpainting-canvas-wrapper">
        <Stage
          tabIndex={-1}
          ref={stageRef}
          className={'inpainting-canvas-stage'}
          style={{
            ...(stageCursor ? { cursor: stageCursor } : {}),
          }}
          x={stageCoordinates.x}
          y={stageCoordinates.y}
          width={stageDimensions.width}
          height={stageDimensions.height}
          scale={{ x: stageScale, y: stageScale }}
          dragBoundFunc={dragBoundFunc}
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseOut}
          onMouseMove={handleMouseMove}
          onMouseOut={handleMouseOut}
          onMouseUp={handleMouseUp}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onWheel={handleWheel}
          listening={(tool === 'move' || isStaging) && !isModifyingBoundingBox}
          draggable={(tool === 'move' || isStaging) && !isModifyingBoundingBox}
        >
          <Layer id={'grid'} visible={shouldShowGrid}>
            <IAICanvasGrid />
          </Layer>

          <Layer
            id={'base'}
            ref={canvasImageLayerRef}
            listening={false}
            imageSmoothingEnabled={false}
          >
            <IAICanvasObjectRenderer />
          </Layer>
          <Layer id={'mask'} visible={isMaskEnabled} listening={false}>
            <IAICanvasMaskLines visible={true} listening={false} />
            <IAICanvasMaskCompositer listening={false} />
          </Layer>
          <Layer id="preview" imageSmoothingEnabled={false}>
            {!isStaging && (
              <IAICanvasBrushPreview
                visible={tool !== 'move'}
                listening={false}
              />
            )}
            <IAICanvasStagingArea visible={isStaging} />
            {shouldShowIntermediates && <IAICanvasIntermediateImage />}
            <IAICanvasBoundingBox
              visible={shouldShowBoundingBox && !isStaging}
            />
          </Layer>
        </Stage>
        <IAICanvasStatusText />
        <IAICanvasStagingAreaToolbar />
      </div>
    </div>
  );
};

export default IAICanvas;