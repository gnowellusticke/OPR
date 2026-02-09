import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, CheckCircle2, AlertCircle, FileJson } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ArmyForgeParser } from './ArmyForgeParser';

export default function ArmyUploader({ label, color, onArmyUploaded }) {
  const [file, setFile] = useState(null);
  const [army, setArmy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [parser] = useState(new ArmyForgeParser());

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);
    setError(null);

    try {
      const text = await selectedFile.text();
      const rawData = JSON.parse(text);
      
      // Try to parse as Army Forge format first
      let parsedData;
      if (rawData.gameSystem && rawData.list && rawData.list.units) {
        // OPR Army Forge format
        parsedData = parser.parse(rawData);
      } else if (rawData.name && rawData.units && Array.isArray(rawData.units)) {
        // Simple format
        parsedData = rawData;
        parsedData.total_points = rawData.units.reduce((sum, unit) => sum + (unit.points || 0), 0);
      } else {
        throw new Error('Unsupported army list format. Please use OPR Army Forge export or simple JSON format.');
      }
      
      // Save to database
      const savedArmy = await base44.entities.ArmyList.create({
        name: parsedData.name,
        faction: parsedData.faction || 'Unknown',
        total_points: parsedData.total_points,
        units: parsedData.units
      });

      setArmy(savedArmy);
      onArmyUploaded(savedArmy);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={`border-2 ${color === 'blue' ? 'border-blue-600' : 'border-red-600'}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="w-5 h-5" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            disabled={loading || army}
            className="flex-1"
          />
          {army && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setArmy(null);
                setFile(null);
                onArmyUploaded(null);
              }}
            >
              <AlertCircle className="w-4 h-4" />
            </Button>
          )}
        </div>

        {loading && (
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full" />
            Processing army list...
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-700 p-3 rounded flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
            <div className="text-sm text-red-300">{error}</div>
          </div>
        )}

        {army && (
          <div className="bg-green-900/20 border border-green-700 p-3 rounded space-y-2">
            <div className="flex items-center gap-2 text-green-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Army Loaded Successfully
            </div>
            <div className="text-sm space-y-1">
              <div><span className="text-slate-400">Name:</span> <span className="text-white">{army.name}</span></div>
              <div><span className="text-slate-400">Faction:</span> <span className="text-white">{army.faction}</span></div>
              <div><span className="text-slate-400">Points:</span> <span className="text-white">{army.total_points}</span></div>
              <div><span className="text-slate-400">Units:</span> <span className="text-white">{army.units.length}</span></div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}