# SP: pSeleccionarContabilizacionAjusteRenglonCostos
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pSeleccionarContabilizacionAjusteRenglonCostos]
    (
      @iRowguid_Padre UNIQUEIDENTIFIER ,
      @iCriterio_Costeo INT --Tipo de Costo con el que se va a contabilizar
	
    )
AS 
    BEGIN
	 
        IF ( @iCriterio_Costeo = 1 ) --COSTO PROMEDIO
            SELECT TOP ( 1 )
                CHS.costo_pro AS Cost_Unit, CHE.fecha_emision AS Fec_Emis, CHS.Cantidad AS Total_art
            FROM
                saCostoHistoricoSalida CHS
                INNER JOIN saCostoHistoricoEntrada CHE ON CHS.cod_costo_historico_entrada = CHE.cod_costo_historico_entrada
            WHERE
                CHS.DOC_ORIG = @iRowguid_Padre
		
        ELSE --ULTIMO COSTO | UEPS_PEPS
            SELECT
                CHE.costo AS Cost_Unit, CHE.fecha_emision AS Fec_Emis, CHS.Cantidad AS Total_art
            FROM
                saCostoHistoricoSalida CHS
                INNER JOIN saCostoHistoricoEntrada CHE ON CHS.cod_costo_historico_entrada = CHE.cod_costo_historico_entrada
            WHERE
                CHS.DOC_ORIG = @iRowguid_Padre
                AND CHE.costo > 0
    END
```
