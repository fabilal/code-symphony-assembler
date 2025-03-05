
import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import _ from 'lodash';
import * as math from 'mathjs';
import { LineChart, BarChart, PieChart, ScatterChart, Line, Bar, Pie, Scatter, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  Download, Upload, Table, ChevronDown, Search, Edit, Save, BarChart2, PieChart as PieChartIcon, TrendingUp, 
  ScatterChart as ScatterChartIcon, FilePlus, FileText, Trash2, AlertTriangle, CheckCircle, Database,
  Brain, GitBranch, List, Grid, RefreshCw, Settings, ChevronRight, ArrowUpDown, Info, ChartLine
} from 'lucide-react';

// Import UI components
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const Index = () => {
  // State for current active tab
  const [activeTab, setActiveTab] = useState('import');
  
  // State for data
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // State for data table
  const [searchQuery, setSearchQuery] = useState('');
  const [filterColumn, setFilterColumn] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: '' });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // State for visualization
  const [selectedVisType, setSelectedVisType] = useState('line');
  const [selectedColumns, setSelectedColumns] = useState({ x: '', y: [] });
  
  // State for cleaning
  const [dataStats, setDataStats] = useState({});
  const [cleaningMethod, setCleaningMethod] = useState('mean');
  const [columnToClean, setColumnToClean] = useState('');
  const [cleaningTarget, setCleaningTarget] = useState('both'); // 'missing', 'outliers', 'both'
  
  // State for ML
  const [mlModel, setMlModel] = useState('linear');
  const [targetColumn, setTargetColumn] = useState('');
  const [featureColumns, setFeatureColumns] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [mlMetrics, setMlMetrics] = useState({});
  const [timeColumn, setTimeColumn] = useState('');
  const [forecastPeriods, setForecastPeriods] = useState(10);
  const [correlationMatrix, setCorrelationMatrix] = useState({});
  
  // State for Auto ML
  const [autoMlResults, setAutoMlResults] = useState([]);
  const [bestModel, setBestModel] = useState(null);
  const [isAutoMlRunning, setIsAutoMlRunning] = useState(false);
  
  // Refs
  const fileInputRef = useRef(null);
  
  // Reset message after 5 seconds
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  
  // Calculate statistics when data changes
  useEffect(() => {
    if (data.length > 0 && columns.length > 0) {
      calculateDataStats();
      setCorrelationMatrix(calculateCorrelations());
    }
  }, [data, columns]);
  
  // Handler for file import
  const handleFileImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsLoading(true);
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      
      if (file.name.endsWith('.csv')) {
        Papa.parse(content, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            processImportedData(results.data, results.meta.fields);
          },
          error: (error) => {
            setMessage({ type: 'error', text: `Erreur lors de l'analyse du fichier CSV: ${error}` });
            setIsLoading(false);
          }
        });
      } else if (file.name.endsWith('.json')) {
        try {
          const jsonData = JSON.parse(content);
          const jsonArray = Array.isArray(jsonData) ? jsonData : [jsonData];
          const jsonColumns = Object.keys(jsonArray[0] || {});
          processImportedData(jsonArray, jsonColumns);
        } catch (error) {
          setMessage({ type: 'error', text: `Erreur lors de l'analyse du fichier JSON: ${error}` });
          setIsLoading(false);
        }
      } else {
        setMessage({ type: 'error', text: 'Format de fichier non pris en charge. Importez un fichier CSV ou JSON.' });
        setIsLoading(false);
      }
    };
    
    reader.onerror = () => {
      setMessage({ type: 'error', text: 'Erreur lors de la lecture du fichier.' });
      setIsLoading(false);
    };
    
    reader.readAsText(file);
  };
  
  // Process imported data
  const processImportedData = (importedData, importedColumns) => {
    setData(importedData);
    setColumns(importedColumns);
    
    // Initialize visualization with first numeric column as Y and datetime column (if any) as X
    const numericColumns = importedColumns.filter(col => 
      importedData.length > 0 && typeof importedData[0][col] === 'number'
    );
    
    const dateColumns = importedColumns.filter(col => 
      importedData.length > 0 && 
      (typeof importedData[0][col] === 'string' && 
        (importedData[0][col].match(/^\d{4}-\d{2}-\d{2}/) || 
         importedData[0][col].match(/^\d{2}\/\d{2}\/\d{4}/)))
    );
    
    if (dateColumns.length > 0) {
      setTimeColumn(dateColumns[0]);
      setSelectedColumns({
        x: dateColumns[0],
        y: numericColumns.length > 0 ? [numericColumns[0]] : []
      });
    } else if (numericColumns.length > 1) {
      setSelectedColumns({
        x: numericColumns[0],
        y: [numericColumns[1]]
      });
    } else if (importedColumns.length > 1) {
      setSelectedColumns({
        x: importedColumns[0],
        y: [importedColumns[1]]
      });
    }
    
    setIsLoading(false);
    setMessage({ type: 'success', text: `Fichier "${fileName}" importé avec succès. ${importedData.length} lignes, ${importedColumns.length} colonnes.` });
    setActiveTab('data');
  };
  
  // Export data as CSV
  const exportData = () => {
    if (data.length === 0) {
      setMessage({ type: 'error', text: 'Aucune donnée à exporter.' });
      return;
    }
    
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `exported_${fileName || 'data'}`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setMessage({ type: 'success', text: 'Données exportées avec succès.' });
  };
  
  // Update cell in data table
  const updateCell = (rowIndex, column, value) => {
    const updatedData = [...data];
    updatedData[rowIndex][column] = value;
    setData(updatedData);
    setHasUnsavedChanges(true);
  };
  
  // Save modifications
  const saveModifications = () => {
    localStorage.setItem(`data_${fileName}`, JSON.stringify(data));
    setHasUnsavedChanges(false);
    setMessage({ type: 'success', text: 'Modifications sauvegardées avec succès.' });
  };
  
  // Sort data
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  // Get sorted and filtered data
  const getSortedAndFilteredData = () => {
    let filteredData = [...data];
    
    // Apply search filter across all columns
    if (searchQuery) {
      const lowerCaseQuery = searchQuery.toLowerCase();
      filteredData = filteredData.filter(item => 
        Object.values(item).some(val => 
          val !== null && 
          val !== undefined && 
          val.toString().toLowerCase().includes(lowerCaseQuery)
        )
      );
    }
    
    // Apply column-specific filter
    if (filterColumn && filterValue) {
      filteredData = filteredData.filter(item => {
        const val = item[filterColumn];
        return val !== null && 
               val !== undefined && 
               val.toString().toLowerCase().includes(filterValue.toLowerCase());
      });
    }
    
    // Apply sorting
    if (sortConfig.key) {
      filteredData.sort((a, b) => {
        if (a[sortConfig.key] === null || a[sortConfig.key] === undefined) return 1;
        if (b[sortConfig.key] === null || b[sortConfig.key] === undefined) return -1;
        
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        // Convert to numbers if possible for numeric sorting
        if (!isNaN(aValue) && !isNaN(bValue)) {
          aValue = Number(aValue);
          bValue = Number(bValue);
        } else {
          // Convert to lowercase strings for string comparison
          aValue = aValue.toString().toLowerCase();
          bValue = bValue.toString().toLowerCase();
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return filteredData;
  };
  
  // Calculate statistics for data
  const calculateDataStats = () => {
    const stats = {};
    
    columns.forEach(col => {
      const values = data.map(row => row[col]).filter(val => val !== null && val !== undefined);
      const numericValues = values.filter(val => typeof val === 'number');
      
      stats[col] = {
        type: numericValues.length === values.length ? 'numeric' : 'categorical',
        count: values.length,
        missing: data.length - values.length,
        unique: new Set(values).size
      };
      
      if (stats[col].type === 'numeric' && numericValues.length > 0) {
        stats[col].min = math.min(numericValues);
        stats[col].max = math.max(numericValues);
        stats[col].mean = math.mean(numericValues);
        stats[col].median = math.median(numericValues);
        stats[col].std = math.std(numericValues);
        
        // Detect outliers using IQR method
        const q1 = math.quantileSeq(numericValues, 0.25);
        const q3 = math.quantileSeq(numericValues, 0.75);
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        stats[col].outliers = numericValues.filter(val => val < lowerBound || val > upperBound).length;
        stats[col].q1 = q1;
        stats[col].q3 = q3;
      } else if (stats[col].type === 'categorical') {
        const valueCounts = _.countBy(values);
        stats[col].topValues = Object.entries(valueCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([value, count]) => ({ value, count }));
      }
    });
    
    setDataStats(stats);
  };
  
  // Calculate correlations between variables
  const calculateCorrelations = () => {
    if (data.length === 0 || columns.length === 0) return {};
    
    // Get only numeric columns
    const numericColumns = columns.filter(col => 
      dataStats[col] && dataStats[col].type === 'numeric'
    );
    
    if (numericColumns.length < 2) return {}; // Need at least 2 numeric columns
    
    const correlations = {};
    
    // Calculate correlation for each pair of columns
    for (let i = 0; i < numericColumns.length; i++) {
      const col1 = numericColumns[i];
      correlations[col1] = {};
      
      for (let j = 0; j < numericColumns.length; j++) {
        const col2 = numericColumns[j];
        
        if (i === j) {
          correlations[col1][col2] = 1; // Self correlation is always 1
          continue;
        }
        
        // Get values for both columns, excluding rows with missing values
        const values = data.filter(row => 
          row[col1] !== null && row[col1] !== undefined && row[col1] !== '' &&
          row[col2] !== null && row[col2] !== undefined && row[col2] !== ''
        ).map(row => [row[col1], row[col2]]);
        
        if (values.length < 2) {
          correlations[col1][col2] = null;
          continue;
        }
        
        // Calculate Pearson correlation
        const n = values.length;
        const sumX = values.reduce((sum, [x, _]) => sum + x, 0);
        const sumY = values.reduce((sum, [_, y]) => sum + y, 0);
        const sumXY = values.reduce((sum, [x, y]) => sum + x * y, 0);
        const sumXX = values.reduce((sum, [x, _]) => sum + x * x, 0);
        const sumYY = values.reduce((sum, [_, y]) => sum + y * y, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
        
        correlations[col1][col2] = denominator === 0 ? 0 : numerator / denominator;
      }
    }
    
    return correlations;
  };
  
  // Clean data
  const cleanData = () => {
    if (!columnToClean) {
      setMessage({ type: 'error', text: 'Sélectionnez une colonne à nettoyer.' });
      return;
    }
    
    const stats = dataStats[columnToClean];
    if (!stats) return;
    
    const updatedData = [...data];
    let replacementValue;
    
    switch (cleaningMethod) {
      case 'mean':
        replacementValue = stats.mean;
        break;
      case 'median':
        replacementValue = stats.median;
        break;
      case 'zero':
        replacementValue = 0;
        break;
      case 'remove':
        // Filter out rows with missing values or outliers in selected column
        let filteredData;
        
        if (cleaningTarget === 'missing' || cleaningTarget === 'both') {
          filteredData = data.filter(row => 
            row[columnToClean] !== null && 
            row[columnToClean] !== undefined &&
            row[columnToClean] !== ''
          );
        } else {
          filteredData = [...data];
        }
        
        if (stats.type === 'numeric' && (cleaningTarget === 'outliers' || cleaningTarget === 'both')) {
          const q1 = stats.q1;
          const q3 = stats.q3;
          const iqr = q3 - q1;
          const lowerBound = q1 - 1.5 * iqr;
          const upperBound = q3 + 1.5 * iqr;
          
          filteredData = filteredData.filter(row => {
            const value = row[columnToClean];
            return !(typeof value === 'number' && (value < lowerBound || value > upperBound));
          });
        }
        
        setData(filteredData);
        setMessage({ 
          type: 'success', 
          text: `Lignes avec ${cleaningTarget === 'missing' ? 'valeurs manquantes' : 
                               cleaningTarget === 'outliers' ? 'valeurs aberrantes' : 
                               'valeurs manquantes ou aberrantes'} dans "${columnToClean}" supprimées.` 
        });
        calculateDataStats();
        return;
      default:
        replacementValue = stats.mean;
    }
    
    // Replace missing or outlier values
    if (stats.type === 'numeric') {
      const q1 = stats.q1;
      const q3 = stats.q3;
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      
      updatedData.forEach((row, index) => {
        const value = row[columnToClean];
        const isMissing = value === null || value === undefined || value === '';
        const isOutlier = typeof value === 'number' && (value < lowerBound || value > upperBound);
        
        if ((cleaningTarget === 'missing' && isMissing) || 
            (cleaningTarget === 'outliers' && isOutlier) || 
            (cleaningTarget === 'both' && (isMissing || isOutlier))) {
          updatedData[index][columnToClean] = replacementValue;
        }
      });
    } else {
      // For categorical, replace missing values with most common value
      const mostCommonValue = stats.topValues && stats.topValues.length > 0 
        ? stats.topValues[0].value 
        : '';
      
      updatedData.forEach((row, index) => {
        const value = row[columnToClean];
        if (cleaningTarget === 'missing' || cleaningTarget === 'both') {
          if (value === null || value === undefined || value === '') {
            updatedData[index][columnToClean] = mostCommonValue;
          }
        }
      });
    }
    
    setData(updatedData);
    setMessage({ 
      type: 'success', 
      text: `Nettoyage de la colonne "${columnToClean}" effectué ${
        cleaningTarget === 'missing' ? 'pour les valeurs manquantes' : 
        cleaningTarget === 'outliers' ? 'pour les valeurs aberrantes' : 
        'pour les valeurs manquantes et aberrantes'
      }.` 
    });
    calculateDataStats();
  };
  
  // Run time series prediction
  const runTimeSeries = () => {
    if (!targetColumn || !timeColumn) {
      setMessage({ type: 'error', text: 'Sélectionnez une colonne cible et une colonne temporelle.' });
      return;
    }
    
    setIsLoading(true);
    
    // Format data for time series analysis
    const timeSeriesData = data
      .filter(row => row[timeColumn] && row[targetColumn])
      .map(row => ({
        time: new Date(row[timeColumn]).getTime(),
        value: row[targetColumn]
      }))
      .sort((a, b) => a.time - b.time);
    
    if (timeSeriesData.length < 10) {
      setMessage({ type: 'error', text: 'Pas assez de données pour l\'analyse de séries temporelles (minimum 10 points).' });
      setIsLoading(false);
      return;
    }
    
    // Simple time series prediction
    const trainSize = Math.floor(timeSeriesData.length * 0.8);
    const trainData = timeSeriesData.slice(0, trainSize);
    const testData = timeSeriesData.slice(trainSize);
    
    let predictions = [];
    let metrics = {};
    
    switch (mlModel) {
      case 'moving-average':
        // Simple Moving Average
        const windowSize = 3;
        predictions = testData.map((point, i) => {
          const startIdx = trainData.length + i - windowSize;
          const endIdx = trainData.length + i;
          const window = timeSeriesData.slice(startIdx, endIdx);
          const avg = window.reduce((sum, p) => sum + p.value, 0) / window.length;
          return {
            time: point.time,
            actual: point.value,
            predicted: avg
          };
        });
        break;
        
      case 'linear':
      default:
        // Simple linear regression
        const xValues = trainData.map((d, i) => i);
        const yValues = trainData.map(d => d.value);
        
        // Calculate slope and intercept
        const n = xValues.length;
        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = xValues.reduce((a, b, i) => a + b * yValues[i], 0);
        const sumXX = xValues.reduce((a, b) => a + b * b, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        predictions = testData.map((point, i) => {
          const x = trainData.length + i;
          const predicted = slope * x + intercept;
          return {
            time: point.time,
            actual: point.value,
            predicted: predicted
          };
        });
        break;
    }
    
    // Calculate metrics
    const errors = predictions.map(p => p.actual - p.predicted);
    const mae = errors.reduce((sum, err) => sum + Math.abs(err), 0) / errors.length;
    const rmse = Math.sqrt(errors.reduce((sum, err) => sum + err * err, 0) / errors.length);
    
    // Calculate R²
    const meanActual = predictions.reduce((sum, p) => sum + p.actual, 0) / predictions.length;
    const totalSS = predictions.reduce((sum, p) => sum + Math.pow(p.actual - meanActual, 2), 0);
    const residualSS = errors.reduce((sum, err) => sum + Math.pow(err, 2), 0);
    const rSquared = 1 - (residualSS / totalSS);
    
    metrics = {
      mae: mae.toFixed(4),
      rmse: rmse.toFixed(4),
      rSquared: rSquared.toFixed(4)
    };
    
    // Generate forecast for future periods
    const lastTime = timeSeriesData[timeSeriesData.length - 1].time;
    const timeInterval = (lastTime - timeSeriesData[timeSeriesData.length - 2].time);
    
    const forecast = [];
    for (let i = 1; i <= forecastPeriods; i++) {
      const forecastTime = lastTime + i * timeInterval;
      let forecastValue;
      
      if (mlModel === 'moving-average') {
        const lastValues = timeSeriesData.slice(-windowSize).map(d => d.value);
        forecastValue = lastValues.reduce((a, b) => a + b, 0) / lastValues.length;
      } else {
        // Linear model
        forecastValue = slope * (timeSeriesData.length + i - 1) + intercept;
      }
      
      forecast.push({
        time: forecastTime,
        predicted: forecastValue
      });
    }
    
    // Combine historical data, predictions and forecast for visualization
    const allData = [
      ...timeSeriesData.map(d => ({
        time: d.time,
        actual: d.value
      })),
      ...predictions.map(p => ({
        time: p.time,
        actual: p.actual,
        predicted: p.predicted
      })),
      ...forecast.map(f => ({
        time: f.time,
        forecast: f.predicted
      }))
    ].sort((a, b) => a.time - b.time);
    
    setPrediction(allData);
    setMlMetrics(metrics);
    setIsLoading(false);
    setMessage({ type: 'success', text: `Prédiction effectuée avec ${mlModel === 'linear' ? 'régression linéaire' : 'moyenne mobile'}.` });
  };
  
  // Run Auto ML
  const runAutoML = () => {
    if (!targetColumn || !timeColumn) {
      setMessage({ type: 'error', text: 'Sélectionnez une colonne cible et une colonne temporelle.' });
      return;
    }
    
    setIsAutoMlRunning(true);
    setMessage({ type: 'info', text: 'Analyse AutoML en cours...' });
    
    // Format data for time series analysis
    const timeSeriesData = data
      .filter(row => row[timeColumn] && row[targetColumn])
      .map(row => ({
        time: new Date(row[timeColumn]).getTime(),
        value: row[targetColumn]
      }))
      .sort((a, b) => a.time - b.time);
    
    if (timeSeriesData.length < 10) {
      setMessage({ type: 'error', text: 'Pas assez de données pour l\'analyse AutoML (minimum 10 points).' });
      setIsAutoMlRunning(false);
      return;
    }
    
    // Train different models
    const trainSize = Math.floor(timeSeriesData.length * 0.8);
    const trainData = timeSeriesData.slice(0, trainSize);
    const testData = timeSeriesData.slice(trainSize);
    
    const models = [
      { name: 'Régression Linéaire', id: 'linear' },
      { name: 'Moyenne Mobile (3)', id: 'ma-3' },
      { name: 'Moyenne Mobile (5)', id: 'ma-5' },
      { name: 'Moyenne Exponentielle', id: 'exp' }
    ];
    
    // Test each model
    const modelResults = models.map(model => {
      let predictions;
      
      switch (model.id) {
        case 'ma-3':
          // Moving Average with window 3
          predictions = testData.map((point, i) => {
            const startIdx = trainData.length + i - 3;
            const endIdx = trainData.length + i;
            const window = timeSeriesData.slice(Math.max(0, startIdx), endIdx);
            const avg = window.reduce((sum, p) => sum + p.value, 0) / window.length;
            return {
              time: point.time,
              actual: point.value,
              predicted: avg
            };
          });
          break;
          
        case 'ma-5':
          // Moving Average with window 5
          predictions = testData.map((point, i) => {
            const startIdx = trainData.length + i - 5;
            const endIdx = trainData.length + i;
            const window = timeSeriesData.slice(Math.max(0, startIdx), endIdx);
            const avg = window.reduce((sum, p) => sum + p.value, 0) / window.length;
            return {
              time: point.time,
              actual: point.value,
              predicted: avg
            };
          });
          break;
          
        case 'exp':
          // Exponential Smoothing (alpha = 0.3)
          const alpha = 0.3;
          predictions = [];
          let lastSmoothed = trainData[trainData.length - 1].value;
          
          testData.forEach(point => {
            lastSmoothed = alpha * point.value + (1 - alpha) * lastSmoothed;
            predictions.push({
              time: point.time,
              actual: point.value,
              predicted: lastSmoothed
            });
          });
          break;
          
        case 'linear':
        default:
          // Linear regression
          const xValues = trainData.map((d, i) => i);
          const yValues = trainData.map(d => d.value);
          
          const n = xValues.length;
          const sumX = xValues.reduce((a, b) => a + b, 0);
          const sumY = yValues.reduce((a, b) => a + b, 0);
          const sumXY = xValues.reduce((a, b, i) => a + b * yValues[i], 0);
          const sumXX = xValues.reduce((a, b) => a + b * b, 0);
          
          const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
          const intercept = (sumY - slope * sumX) / n;
          
          predictions = testData.map((point, i) => {
            const x = trainData.length + i;
            const predicted = slope * x + intercept;
            return {
              time: point.time,
              actual: point.value,
              predicted: predicted
            };
          });
          break;
      }
      
      // Calculate metrics
      const errors = predictions.map(p => p.actual - p.predicted);
      const mae = errors.reduce((sum, err) => sum + Math.abs(err), 0) / errors.length;
      const rmse = Math.sqrt(errors.reduce((sum, err) => sum + err * err, 0) / errors.length);
      
      // Calculate R²
      const meanActual = predictions.reduce((sum, p) => sum + p.actual, 0) / predictions.length;
      const totalSS = predictions.reduce((sum, p) => sum + Math.pow(p.actual - meanActual, 2), 0);
      const residualSS = errors.reduce((sum, err) => sum + Math.pow(err, 2), 0);
      const rSquared = 1 - (residualSS / totalSS);
      
      return {
        model: model.name,
        id: model.id,
        mae: mae,
        rmse: rmse,
        rSquared: rSquared,
        predictions: predictions
      };
    });
    
    // Sort by RMSE (lower is better)
    const sortedResults = [...modelResults].sort((a, b) => a.rmse - b.rmse);
    const best = sortedResults[0];
    
    // Generate forecast with best model
    const lastTime = timeSeriesData[timeSeriesData.length - 1].time;
    const timeInterval = (lastTime - timeSeriesData[timeSeriesData.length - 2].time);
    
    const forecast = [];
    for (let i = 1; i <= forecastPeriods; i++) {
      const forecastTime = lastTime + i * timeInterval;
      let forecastValue;
      
      if (best.id === 'linear') {
        // Linear model
        const xValues = trainData.map((d, i) => i);
        const yValues = trainData.map(d => d.value);
        
        const n = xValues.length;
        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = xValues.reduce((a, b, i) => a + b * yValues[i], 0);
        const sumXX = xValues.reduce((a, b) => a + b * b, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        forecastValue = slope * (timeSeriesData.length + i - 1) + intercept;
      } else if (best.id.startsWith('ma')) {
        // Moving Average
        const windowSize = best.id === 'ma-3' ? 3 : 5;
        const lastValues = timeSeriesData.slice(-windowSize).map(d => d.value);
        forecastValue = lastValues.reduce((a, b) => a + b, 0) / lastValues.length;
      } else {
        // Exponential
        const alpha = 0.3;
        let lastSmoothed = timeSeriesData[timeSeriesData.length - 1].value;
        for (let j = 0; j < i; j++) {
          lastSmoothed = alpha * lastSmoothed + (1 - alpha) * lastSmoothed;
        }
        forecastValue = lastSmoothed;
      }
      
      forecast.push({
        time: forecastTime,
        predicted: forecastValue
      });
    }
    
    // Combine historical data, predictions and forecast for visualization
    const allData = [
      ...timeSeriesData.map(d => ({
        time: d.time,
        actual: d.value
      })),
      ...best.predictions.map(p => ({
        time: p.time,
        actual: p.actual,
        predicted: p.predicted
      })),
      ...forecast.map(f => ({
        time: f.time,
        forecast: f.predicted
      }))
    ].sort((a, b) => a.time - b.time);
    
    setAutoMlResults(modelResults);
    setBestModel({
      name: best.model,
      id: best.id,
      mae: best.mae.toFixed(4),
      rmse: best.rmse.toFixed(4),
      rSquared: best.rSquared.toFixed(4),
      data: allData
    });
    
    setIsAutoMlRunning(false);
    setMessage({ type: 'success', text: `Analyse AutoML terminée. Meilleur modèle: ${best.model}` });
  };
  
  // UI Components
  const renderImportTab = () => (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Importation de fichiers</h2>
      
      <div className="p-8 border-2 border-dashed rounded-lg text-center cursor-pointer hover:bg-gray-50"
        onClick={() => fileInputRef.current.click()}>
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">Cliquez pour importer un fichier CSV, JSON, Excel</p>
        <p className="text-xs text-gray-500">Formats supportés: .csv, .json</p>
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".csv,.json,.xlsx,.txt" 
          className="hidden"
          onChange={handleFileImport}
        />
      </div>
      
      {isLoading && (
        <div className="mt-4 text-center">
          <RefreshCw className="animate-spin h-8 w-8 mx-auto text-blue-500" />
          <p>Importation en cours...</p>
        </div>
      )}
    </div>
  );
  
  const renderDataTab = () => {
    const sortedAndFilteredData = getSortedAndFilteredData();
    
    return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Tableau de données</h2>
        <div className="flex space-x-2">
          <button 
            className={`inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white ${hasUnsavedChanges ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400'}`}
            onClick={saveModifications}
            disabled={!hasUnsavedChanges}
          >
            <Save className="h-4 w-4 mr-1" /> Sauvegarder
          </button>
          <button 
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            onClick={exportData}
          >
            <Download className="h-4 w-4 mr-1" /> Exporter
          </button>
        </div>
      </div>
      
      {data.length > 0 ? (
        <>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Rechercher dans toutes les colonnes..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Column filter */}
            <div className="grid grid-cols-2 gap-2">
              <select
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={filterColumn}
                onChange={e => setFilterColumn(e.target.value)}
              >
                <option value="">Filtrer par colonne...</option>
                {columns.map(column => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
              
              <input
                type="text"
                className="block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Valeur du filtre..."
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
                disabled={!filterColumn}
              />
            </div>
            
            {/* Data stats */}
            <div className="bg-gray-50 p-3 rounded-md flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Total: </span>
                <span className="text-sm">{data.length} lignes</span>
              </div>
              <div>
                <span className="text-sm font-medium">Filtrées: </span>
                <span className="text-sm">{sortedAndFilteredData.length} lignes</span>
              </div>
              <div>
                <span className="text-sm font-medium">Colonnes: </span>
                <span className="text-sm">{columns.length}</span>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  {columns.map(column => (
                    <th 
                      key={column}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => requestSort(column)}
                    >
                      <div className="flex items-center">
                        {column}
                        {sortConfig.key === column ? (
                          <ArrowUpDown className={`ml-1 h-4 w-4 ${sortConfig.direction === 'ascending' ? 'transform rotate-180' : ''}`} />
                        ) : (
                          <ArrowUpDown className="ml-1 h-4 w-4 opacity-20" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedAndFilteredData.slice(0, 100).map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rowIndex + 1}
                    </td>
                    {columns.map(column => (
                      <td 
                        key={`${rowIndex}-${column}`} 
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      >
                        <input
                          type="text"
                          className="border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent w-full"
                          value={row[column] !== null && row[column] !== undefined ? row[column] : ''}
                          onChange={e => updateCell(rowIndex, column, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedAndFilteredData.length > 100 && (
            <div className="mt-2 text-sm text-gray-500 text-right">
              Affichage des 100 premières lignes sur {sortedAndFilteredData.length} filtrées
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-10 border rounded-lg">
          <Database className="h-12 w-12 mx-auto text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune donnée</h3>
          <p className="mt-1 text-sm text-gray-500">Importez un fichier pour commencer.</p>
        </div>
      )}
    </div>
  );};
  
  const renderVisualizationTab = () => (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Visualisation des données</h2>
      </div>
      
      {data.length > 0 ? (
        <div>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de graphique</label>
              <div className="flex flex-wrap gap-2">
                <button
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${selectedVisType === 'line' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => setSelectedVisType('line')}
                >
                  <TrendingUp className="h-4 w-4 mr-1" /> Ligne
                </button>
                <button
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${selectedVisType === 'bar' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => setSelectedVisType('bar')}
                >
                  <BarChart2 className="h-4 w-4 mr-1" /> Barre
                </button>
                <button
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${selectedVisType === 'pie' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => setSelectedVisType('pie')}
                >
                  <PieChartIcon className="h-4 w-4 mr-1" /> Camembert
                </button>
                <button
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${selectedVisType === 'scatter' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => setSelectedVisType('scatter')}
                >
                  <ScatterChartIcon className="h-4 w-4 mr-1" /> Nuage
                </button>
              </div>
            </div>
            
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Axe X</label>
              <select
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={selectedColumns.x}
                onChange={e => setSelectedColumns({...selectedColumns, x: e.target.value})}
              >
                {columns.map(column => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Axe Y / Valeurs
                {selectedVisType !== 'pie' && (
                  <span className="text-xs text-gray-500 ml-1">(Multiselect pour ligne et barre)</span>
                )}
              </label>
              <select
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={selectedColumns.y[0] || ''}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedColumns({...selectedColumns, y: [val]});
                }}
                multiple={selectedVisType === 'line' || selectedVisType === 'bar'}
                size={selectedVisType === 'line' || selectedVisType === 'bar' ? 3 : 1}
              >
                {columns.filter(col => col !== selectedColumns.x).map(column => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="border rounded-lg p-4 bg-white">
            <ResponsiveContainer width="100%" height={400}>
              {selectedVisType === 'line' ? (
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey={selectedColumns.x} 
                    label={{ value: selectedColumns.x, position: 'insideBottom', offset: -5 }} 
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {selectedColumns.y.map((column, index) => (
                    <Line 
                      key={column} 
                      type="monotone" 
                      dataKey={column} 
                      stroke={`hsl(${index * 30 + 200}, 70%, 50%)`} 
                      activeDot={{ r: 8 }} 
                    />
                  ))}
                </LineChart>
              ) : selectedVisType === 'bar' ? (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey={selectedColumns.x} 
                    label={{ value: selectedColumns.x, position: 'insideBottom', offset: -5 }} 
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {selectedColumns.y.map((column, index) => (
                    <Bar 
                      key={column} 
                      dataKey={column} 
                      fill={`hsl(${index * 30 + 200}, 70%, 50%)`} 
                    />
                  ))}
                </BarChart>
              ) : selectedVisType === 'pie' ? (
                <PieChart>
                  <Pie
                    data={data}
                    nameKey={selectedColumns.x}
                    dataKey={selectedColumns.y[0]}
                    cx="50%"
                    cy="50%"
                    outerRadius={150}
                    fill="#8884d8"
                    label
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${index * 15 + 200}, 70%, 50%)`} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              ) : (
                <ScatterChart>
                  <CartesianGrid />
                  <XAxis 
                    type="number" 
                    dataKey={selectedColumns.x} 
                    name={selectedColumns.x}
                    label={{ value: selectedColumns.x, position: 'insideBottom', offset: -5 }} 
                  />
                  <YAxis 
                    type="number" 
                    dataKey={selectedColumns.y[0]} 
                    name={selectedColumns.y[0]} 
                    label={{ value: selectedColumns.y[0], angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={data} fill="#8884d8" />
                </ScatterChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 border rounded-lg">
          <ChartLine className="h-12 w-12 mx-auto text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune donnée</h3>
          <p className="mt-1 text-sm text-gray-500">Importez un fichier pour commencer.</p>
        </div>
      )}
    </div>
  );
  
  const renderCleaningTab = () => (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Nettoyage de données</h2>
      </div>
      
      {data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1 border rounded-lg p-4">
            <h3 className="font-medium mb-2">Options de nettoyage</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Colonne à nettoyer</label>
              <select
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={columnToClean}
                onChange={e => setColumnToClean(e.target.value)}
              >
                <option value="">Sélectionner une colonne</option>
                {columns.map(column => (
                  <option key={column} value={column}>
                    {column} {dataStats[column] ? 
                      `(${dataStats[column].missing > 0 ? `${dataStats[column].missing} manquants` : ''}${
                        dataStats[column].missing > 0 && dataStats[column].type === 'numeric' && dataStats[column].outliers > 0 ? ', ' : ''
                      }${dataStats[column].type === 'numeric' && dataStats[column].outliers > 0 ? 
                        `${dataStats[column].outliers} aberrants` : ''})` : ''}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Valeurs à nettoyer</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="cleaningTarget"
                    value="missing"
                    checked={cleaningTarget === 'missing'}
                    onChange={() => setCleaningTarget('missing')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Valeurs manquantes uniquement</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="cleaningTarget"
                    value="outliers"
                    checked={cleaningTarget === 'outliers'}
                    onChange={() => setCleaningTarget('outliers')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Valeurs aberrantes uniquement</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="cleaningTarget"
                    value="both"
                    checked={cleaningTarget === 'both'}
                    onChange={() => setCleaningTarget('both')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Les deux</span>
                </label>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Méthode de remplacement</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="cleaningMethod"
                    value="mean"
                    checked={cleaningMethod === 'mean'}
                    onChange={() => setCleaningMethod('mean')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Moyenne</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="cleaningMethod"
                    value="median"
                    checked={cleaningMethod === 'median'}
                    onChange={() => setCleaningMethod('median')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Médiane</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="cleaningMethod"
                    value="zero"
                    checked={cleaningMethod === 'zero'}
                    onChange={() => setCleaningMethod('zero')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Zéro</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="cleaningMethod"
                    value="remove"
                    checked={cleaningMethod === 'remove'}
                    onChange={() => setCleaningMethod('remove')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Supprimer les lignes</span>
                </label>
              </div>
            </div>
            
            <button
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
              onClick={cleanData}
              disabled={!columnToClean}
            >
              <CheckCircle className="h-4 w-4 mr-1" /> Nettoyer les données
            </button>
          </div>
          
          <div className="col-span-2 border rounded-lg p-4 overflow-y-auto max-h-96">
            <h3 className="font-medium mb-2">Statistiques des données</h3>
            
            <div className="space-y-4">
              {Object.entries(dataStats).map(([column, stats]) => (
                <div key={column} className="border rounded p-3">
                  <h4 className="font-medium">{column}</h4>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <div>Type: {stats.type === 'numeric' ? 'Numérique' : 'Catégoriel'}</div>
                    <div>Total: {stats.count} valeurs</div>
                    
                    {stats.missing > 0 && (
                      <div className="text-amber-600 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1" /> 
                        {stats.missing} valeurs manquantes
                      </div>
                    )}
                    
                    {stats.type === 'numeric' && (
                      <>
                        <div>Min: {stats.min !== undefined ? stats.min.toFixed(2) : 'N/A'}</div>
                        <div>Max: {stats.max !== undefined ? stats.max.toFixed(2) : 'N/A'}</div>
                        <div>Moyenne: {stats.mean !== undefined ? stats.mean.toFixed(2) : 'N/A'}</div>
                        <div>Médiane: {stats.median !== undefined ? stats.median.toFixed(2) : 'N/A'}</div>
                        <div>Écart-type: {stats.std !== undefined ? stats.std.toFixed(2) : 'N/A'}</div>
                        {stats.outliers > 0 && (
                          <div className="text-amber-600 col-span-2">
                            {stats.outliers} valeurs aberrantes détectées
                          </div>
                        )}
                      </>
                    )}
                    
                    {stats.type === 'categorical' && stats.topValues && (
                      <div className="col-span-2">
                        <div className="font-medium text-xs text-gray-500 mt-1">Valeurs les plus fréquentes:</div>
                        <div className="grid grid-cols-2 gap-x-4 text-xs mt-1">
                          {stats.topValues.map((item, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="truncate">{item.value}</span>
                              <span className="text-gray-500">{item.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 border rounded-lg">
          <AlertTriangle className="h-12 w-12 mx-auto text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune donnée</h3>
          <p className="mt-1 text-sm text-gray-500">Importez un fichier pour commencer.</p>
        </div>
      )}
    </div>
  );

  const renderMachineLearningTab = () => (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Prédiction de séries temporelles</h2>
      </div>
      
      {data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1 border rounded-lg p-4">
            <h3 className="font-medium mb-3">Configuration du modèle</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Colonne temporelle</label>
              <select
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={timeColumn}
                onChange={e => setTimeColumn(e.target.value)}
              >
                <option value="">Sélectionner une colonne</option>
                {columns.map(column => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Colonne cible à prédire</label>
              <select
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={targetColumn}
                onChange={e => setTargetColumn(e.target.value)}
              >
                <option value="">Sélectionner une colonne</option>
                {columns.filter(col => 
                  dataStats[col] && dataStats[col].type === 'numeric'
                ).map(column => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Modèle</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="mlModel"
                    value="linear"
                    checked={mlModel === 'linear'}
                    onChange={() => setMlModel('linear')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Régression linéaire</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="mlModel"
                    value="moving-average"
                    checked={mlModel === 'moving-average'}
                    onChange={() => setMlModel('moving-average')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Moyenne mobile</span>
                </label>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Périodes à prédire</label>
              <input
                type="number"
                min="1"
                max="100"
                value={forecastPeriods}
                onChange={e => setForecastPeriods(parseInt(e.target.value) || 10)}
                className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              />
            </div>
            
            <button
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
              onClick={runTimeSeries}
              disabled={!targetColumn || !timeColumn || isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4 mr-1" /> Calcul en cours...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-1" /> Lancer la prédiction
                </>
              )}
            </button>
          </div>
          
          <div className="col-span-2 border rounded-lg p-4">
            {prediction ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">Résultats de la prédiction</h3>
                  
                  <div className="flex space-x-4 text-sm">
                    <div>
                      <span className="font-medium">MAE:</span> {mlMetrics.mae}
                    </div>
                    <div>
                      <span className="font-medium">RMSE:</span> {mlMetrics.rmse}
                    </div>
                    <div>
                      <span className="font-medium">R²:</span> {mlMetrics.rSquared}
                    </div>
                  </div>
                </div>
                
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={prediction}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      tickFormatter={timeStr => {
                        const date = new Date(timeStr);
                        return `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}`;
                      }}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={timeStr => {
                        const date = new Date(timeStr);
                        return date.toLocaleDateString();
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="actual" 
                      stroke="#8884d8" 
                      activeDot={{ r: 8 }} 
                      name="Données réelles"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="predicted" 
                      stroke="#82ca9d" 
                      name="Prédiction" 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="forecast" 
                      stroke="#ff7300" 
                      strokeDasharray="5 5" 
                      name="Prévision" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-10">
                <Brain className="h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune prédiction</h3>
                <p className="mt-1 text-sm text-gray-500">Configurez et lancez une prédiction pour voir les résultats</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 border rounded-lg">
          <Brain className="h-12 w-12 mx-auto text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune donnée</h3>
          <p className="mt-1 text-sm text-gray-500">Importez un fichier pour commencer.</p>
        </div>
      )}
    </div>
  );
  
  const renderAutoMLTab = () => (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">AutoML</h2>
      </div>
      
      {data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1 border rounded-lg p-4">
            <h3 className="font-medium mb-3">Configuration AutoML</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Colonne temporelle</label>
              <select
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={timeColumn}
                onChange={e => setTimeColumn(e.target.value)}
              >
                <option value="">Sélectionner une colonne</option>
                {columns.map(column => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Colonne cible à prédire</label>
              <select
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={targetColumn}
                onChange={e => setTargetColumn(e.target.value)}
              >
                <option value="">Sélectionner une colonne</option>
                {columns.filter(col => 
                  dataStats[col] && dataStats[col].type === 'numeric'
                ).map(column => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Périodes à prédire</label>
              <input
                type="number"
                min="1"
                max="100"
                value={forecastPeriods}
                onChange={e => setForecastPeriods(parseInt(e.target.value) || 10)}
                className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              />
            </div>
            
            <button
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
              onClick={runAutoML}
              disabled={!targetColumn || !timeColumn || isAutoMlRunning}
            >
              {isAutoMlRunning ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4 mr-1" /> Analyse en cours...
                </>
              ) : (
                <>
                  <GitBranch className="h-4 w-4 mr-1" /> Lancer AutoML
                </>
              )}
            </button>
            
            {autoMlResults.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <h4 className="font-medium mb-2">Comparaison des modèles</h4>
                <div className="space-y-2 text-sm">
                  {autoMlResults.sort((a, b) => a.rmse - b.rmse).map((result, index) => (
                    <div 
                      key={result.id} 
                      className={`p-2 rounded ${index === 0 ? 'bg-blue-50 border border-blue-200' : ''}`}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">{result.model}</span>
                        {index === 0 && <span className="text-blue-600 text-xs">Meilleur</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-1 mt-1">
                        <div className="text-xs">RMSE: {result.rmse.toFixed(4)}</div>
                        <div className="text-xs">MAE: {result.mae.toFixed(4)}</div>
                        <div className="text-xs">R²: {result.rSquared.toFixed(4)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="col-span-2 border rounded-lg p-4">
            {bestModel ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">Meilleur modèle: {bestModel.name}</h3>
                  
                  <div className="flex space-x-4 text-sm">
                    <div>
                      <span className="font-medium">MAE:</span> {bestModel.mae}
                    </div>
                    <div>
                      <span className="font-medium">RMSE:</span> {bestModel.rmse}
                    </div>
                    <div>
                      <span className="font-medium">R²:</span> {bestModel.rSquared}
                    </div>
                  </div>
                </div>
                
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={bestModel.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      tickFormatter={timeStr => {
                        const date = new Date(timeStr);
                        return `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}`;
                      }}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={timeStr => {
                        const date = new Date(timeStr);
                        return date.toLocaleDateString();
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="actual" 
                      stroke="#8884d8" 
                      activeDot={{ r: 8 }} 
                      name="Données réelles"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="predicted" 
                      stroke="#82ca9d" 
                      name="Prédiction" 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="forecast" 
                      stroke="#ff7300" 
                      strokeDasharray="5 5" 
                      name="Prévision" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-10">
                <GitBranch className="h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune analyse AutoML</h3>
                <p className="mt-1 text-sm text-gray-500">Lancez AutoML pour comparer automatiquement plusieurs modèles</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 border rounded-lg">
          <GitBranch className="h-12 w-12 mx-auto text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune donnée</h3>
          <p className="mt-1 text-sm text-gray-500">Importez un fichier pour commencer.</p>
        </div>
      )}
    </div>
  );
  
  // Render navigation tabs
  const renderTabs = () => (
    <div className="border-b">
      <div className="flex -mb-px space-x-8 px-4">
        <button
          className={`py-4 px-1 border-b-2 font-medium text-sm ${
            activeTab === 'import'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('import')}
        >
          <div className="flex items-center">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </div>
        </button>
        
        <button
          className={`py-4 px-1 border-b-2 font-medium text-sm ${
            activeTab === 'data'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('data')}
          disabled={data.length === 0}
        >
          <div className="flex items-center">
            <Table className="h-4 w-4 mr-2" />
            Données
          </div>
        </button>
        
        <button
          className={`py-4 px-1 border-b-2 font-medium text-sm ${
            activeTab === 'visualization'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('visualization')}
          disabled={data.length === 0}
        >
          <div className="flex items-center">
            <BarChart2 className="h-4 w-4 mr-2" />
            Visualisation
          </div>
        </button>
        
        <button
          className={`py-4 px-1 border-b-2 font-medium text-sm ${
            activeTab === 'cleaning'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('cleaning')}
          disabled={data.length === 0}
        >
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" />
            Nettoyage
          </div>
        </button>
        
        <button
          className={`py-4 px-1 border-b-2 font-medium text-sm ${
            activeTab === 'ml'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('ml')}
          disabled={data.length === 0}
        >
          <div className="flex items-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            Prédiction
          </div>
        </button>
        
        <button
          className={`py-4 px-1 border-b-2 font-medium text-sm ${
            activeTab === 'automl'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('automl')}
          disabled={data.length === 0}
        >
          <div className="flex items-center">
            <Brain className="h-4 w-4 mr-2" />
            AutoML
          </div>
        </button>
      </div>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Database className="h-8 w-8 text-blue-600" />
              <h1 className="ml-2 text-2xl font-bold text-gray-900">Dashboard de Data Management & ML</h1>
            </div>
            {message.text && (
              <Alert className={`
                max-w-sm py-2 ${
                  message.type === 'error' 
                    ? 'bg-red-50' 
                    : message.type === 'success'
                    ? 'bg-green-50'
                    : 'bg-blue-50'
                }
              `}>
                <div className="flex">
                  {message.type === 'error' ? (
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  ) : message.type === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <Info className="h-4 w-4 text-blue-400" />
                  )}
                  <AlertTitle className="ml-2 text-sm font-medium">
                    {message.text}
                  </AlertTitle>
                </div>
              </Alert>
            )}
          </div>
        </div>
      </div>
      
      {renderTabs()}
      
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        {activeTab === 'import' && renderImportTab()}
        {activeTab === 'data' && renderDataTab()}
        {activeTab === 'visualization' && renderVisualizationTab()}
        {activeTab === 'cleaning' && renderCleaningTab()}
        {activeTab === 'ml' && renderMachineLearningTab()}
        {activeTab === 'automl' && renderAutoMLTab()}
      </main>
    </div>
  );
};

export default Index;
