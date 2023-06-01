// https://github.com/mui/mui-x/issues/1241#issuecomment-956174121

import { DataGrid} from '@mui/x-data-grid';
import React from 'react';
import _ from 'lodash';

export default class StretchyDataGrid extends React.Component {
  constructor(props) {
    super(props);

    this.ref = React.createRef();
    // Maps the column field to the column index
    this.colFieldMap = Object.fromEntries(this.props.columns.map(
      (col, i) => [col.field, i]
    ));
    
    this.state = {
      columns: _.clone(this.props.columns),
      prevContentWidths: new Array(this.props.columns.length).fill(0),
      // When columns are hidden, the Dom row indexes shift left
      colDomRowMap: this.props.columns.map((_, i) => i),
    };
  }

  componentDidMount() {
    this.stretchColumns();
  }

  newLeftShiftCDRM = (colIndex) => {
    const cdrm = [...this.state.colDomRowMap];

    // replace the column with null
    cdrm[colIndex] = null;

    // decrement all non-null columns to the right
    for (let i = colIndex + 1; i < cdrm.length; i++) {
      if (cdrm[i] !== null) {
        cdrm[i]--;
      }
    }

    return cdrm;
  }

  newRightShiftCDRM = (colIndex) => {
    const cdrm = [...this.state.colDomRowMap];

    // if the column is the first column, it should always be set to 0
    if (colIndex === 0) {
      cdrm[colIndex] = 0;

    // else, replace the column with the first non-null value to the left + 1
    // or 0 if none are found
    } else {
      for (let i = colIndex - 1; i >= 0; i--) {
        if (cdrm[i] !== null) {
          cdrm[colIndex] = cdrm[i] + 1;
          break;
        } else if (i === 0) {
          cdrm[colIndex] = 0;
        }
      }
    }

    // increment all non-null columns to the right
    for (let i = colIndex + 1; i < cdrm.length; i++) {
      if (cdrm[i] !== null) {
        cdrm[i]++;
      }
    }

    return cdrm;
  }

  updateColDomRowMap = (model) => {
    // Find the column that was changed
    // (the model only tracks columns that have ever been changed)
    const [colIndex, colWasNull] = (() => {
      const colFieldNames = Object.keys(model);
      for (let i = 0; i < colFieldNames.length; i++) {
        const colFieldName = colFieldNames[i];
        const colIndex = this.colFieldMap[colFieldName];
        const colWasNull = model[colFieldName];
        if (colWasNull === (this.state.colDomRowMap[colIndex] === null)) {
          return [colIndex, colWasNull];
        }
      }
      throw new Error('No column was changed');
    })();
  
    const newCDRM = (() => {
      // If the column has been Shown (previously Hidden),
      // shift columns after it to the right
      if (colWasNull) {
        return this.newRightShiftCDRM(colIndex);
        
      // If the column has been Hidden (previously Shown),
      // shift columns after it to the left
      } else {
        return this.newLeftShiftCDRM(colIndex);
      }
    })();
    
    console.log(newCDRM)
    this.setState({ colDomRowMap: newCDRM });
  }

  getDomRows = () => {
    const ref = this.ref;
    const domRows = [...ref.current?.querySelectorAll('.MuiDataGrid-row')];
    if (this.props.rows?.length === 0 || domRows.length) {
      return domRows;
    }
    return setTimeout(this.getDomRows, 1);
  }

  getCurrentColumnWidths = (colIndex, domRows) => {
    return domRows.reduce(
      ([prevMaxCellWidth, prevMaxContentWidth], domRow) => {
        // Cell is the i-th child of the row (indexed by the column)
        const domCell = domRow.childNodes[this.state.colDomRowMap[colIndex]];
        const domCellWidth = domCell?.scrollWidth || 0;

        // Content is the first child of the cell
        const domContent = domCell?.firstChild;
        const domContentWidth = domContent?.scrollWidth || 0;

        // Return the max between current and previous columns
        // (or between current and default 0 if first iteration)
        return [
          Math.max(prevMaxCellWidth, domCellWidth),
          Math.max(prevMaxContentWidth, domContentWidth),
        ];
      },
      [0, 0], // default values for reduce
    );
  }

  // Using setTimeout with a delay of 0 effectively defers the execution of
  // the code until the next available event loop iteration, allowing the
  // rendering to finish first.
  stretchColumns = () => setTimeout(() => {
    const domRows = this.getDomRows();
    let newColumns = null;
    let newContentWidths = null;

    for (let i = 0; i < this.state.columns.length; i++) {

      // Check if we should resize the column only if it's stretchable
      if (this.state.columns[i].stretch
        && this.state.colDomRowMap[i] !== null
      ) {
        const prevCellWidth = this.state.columns[i].width;
        const prevContentWidth = this.state.prevContentWidths[i];
        const [currentCellWidth, currentContentWidth] = this
          .getCurrentColumnWidths(i, domRows);

        // Column should be resized if the content width has changed
        if (currentContentWidth !== prevContentWidth) {
          // Initialize new columns and widths if they're null
          if (!newColumns) {
            newColumns = _.clone(this.state.columns);
            newContentWidths = [...this.state.prevContentWidths];
          }

          // Update the new content width for the column
          newContentWidths[i] = currentContentWidth;

          // Column width should be increased
          if (currentCellWidth > prevCellWidth) {
            newColumns[i].width = currentCellWidth;

          // Column width should be decreased
          } else if (currentContentWidth < prevContentWidth) {
            newColumns[i].width = currentContentWidth
              + currentCellWidth
              - prevContentWidth;

          // Column width should be unchanged
          } else {
            console.log("Unreachable");
          }
        }
      }
    }

    // Update the state if we have new columns or widths
    if (newColumns) {
      this.setState({
        columns: newColumns,
        prevContentWidths: newContentWidths,
      });
    }
  }, 0) // timeout delay

  render() {
    const { columns, ...props } = this.props;
    return React.createElement(DataGrid, {
      onColumnVisibilityModelChange: (model) => {
        this.updateColDomRowMap(model);
        this.stretchColumns();
      },
      onSortModelChange: this.stretchColumns,
      onFilterModelChange: this.stretchColumns,
      onPaginationModelChange: this.stretchColumns,
      ref: this.ref,
      columns: this.state.columns,
      ...props, /* eslint-disable-line react/jsx-props-no-spreading */
    });
  }
}
