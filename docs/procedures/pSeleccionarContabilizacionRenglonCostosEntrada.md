# SP: pSeleccionarContabilizacionRenglonCostosEntrada
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pSeleccionarContabilizacionRenglonCostosEntrada]
    (
      @iRowguid_Padre UNIQUEIDENTIFIER ,
      @iCriterio_Costeo INT ,--Tipo de Costo con el que se va a contabilizar
      @bInv_Permanente_Detallado BIT--1 si los parametros de empresa inventario detallado es falso y permanente verdadero en todas las demas opcciones es 0
	
    )
AS 
    BEGIN
	 
        IF ( @iCriterio_Costeo = 1
             AND @bInv_Permanente_Detallado = 0
           ) --COSTO PROMEDIO Inventario Detallado
            BEGIN
                SELECT TOP (1)
                    CHE.costo_pro AS Cost_Unit, CHE.fecha_emision AS Fec_Emis, CHE.Cantidad AS Total_art,
                    0.00 AS Costo_Total
                FROM
				saCostoHistoricoEntrada CHE --ON CHS.cod_costo_historico_entrada = CHE.cod_costo_historico_entrada
                WHERE
                    CHE.DOC_ORIG = @iRowguid_Padre
            END
     
        IF ( @iCriterio_Costeo = 1
             AND @bInv_Permanente_Detallado = 1
           ) --COSTO PROMEDIO Inventario permanente
            BEGIN
                SELECT TOP ( 1 )
                   che.costo_pro AS Cost_Unit, GETDATE() AS Fec_Emis, che.cantidad AS Total_art,
                     ISNULL(SUM(CHE.costo_pro * CHE.Cantidad), 0) AS Costo_Total
                FROM
                 --   saCostoHistoricoSalida CHS
                    saCostoHistoricoEntrada CHE --ON CHS.cod_costo_historico_entrada = CHE.cod_costo_historico_entrada
                WHERE
                    CHE.DOC_ORIG = @iRowguid_Padre
				group by che.costo_pro,che.cantidad
            END
        IF ( @iCriterio_Costeo <> 1
             AND @bInv_Permanente_Detallado = 1
           ) --ULTIMO COSTO | UEPS_PEPS Inventario detallado
            BEGIN
                SELECT
                    CHE.costo AS Cost_Unit, CHE.fecha_emision AS Fec_Emis, CHE.Cantidad AS Total_art,
                   -- 0.00 AS Costo_Total
					CHE.costo as Costo_Total
                FROM
                  --  saCostoHistoricoSalida CHS
                    saCostoHistoricoEntrada CHE --ON CHS.cod_costo_historico_entrada = CHE.cod_costo_historico_entrada
                WHERE
                    CHE.DOC_ORIG = @iRowguid_Padre
            END
	
        IF ( @iCriterio_Costeo <> 1
             AND @bInv_Permanente_Detallado = 0
           ) --ULTIMO COSTO | UEPS_PEPS Inventario permanente
            BEGIN
                SELECT
```
