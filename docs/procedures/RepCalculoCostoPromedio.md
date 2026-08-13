# SP: RepCalculoCostoPromedio
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saPista`](../tables/saPista.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04/08/2011>
-- Description:	<Reporte de Calculo de Costo Promedio>
-- =============================================
CREATE PROCEDURE [RepCalculoCostoPromedio] 
	-- Add the parameters for the stored procedure here
    @d_Fecha_d SMALLDATETIME = NULL ,
    @d_Fecha_h SMALLDATETIME = NULL ,
    
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

    	SET @d_Fecha_d = dbo.FechaSimple(@d_Fecha_d)
    	SET @d_Fecha_h = dbo.FechaSimple(@d_Fecha_h)
    	
        SELECT
           MAX(fecha) AS fecha--, P2.cantidad, P2.rowguidOri  
        FROM
            saPista P INNER JOIN 
            (SELECT rowguidOri, COUNT(rowguidOri) AS cantidad 
             FROM saPista WHERE tablaOri = 'CalculaCostoPromedio' GROUP BY rowguidOri) P2 ON P.rowguidOri = P2.rowguidOri
        WHERE
            ( ( @d_Fecha_d IS NULL
                OR dbo.FechaSimple(fecha) >= @d_Fecha_d
              )
              AND ( @d_Fecha_h IS NULL
                    OR dbo.FechaSimple(fecha) <= @d_Fecha_h
                  )
            )          
        
        GROUP BY P2.cantidad, P2.rowguidOri 
        ORDER BY
        fecha DESC

    END
```
