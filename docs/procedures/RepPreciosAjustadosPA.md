# SP: RepPreciosAjustadosPA
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjPrecioCostoAuto`](../tables/saAjPrecioCostoAuto.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saPista`](../tables/saPista.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <31/08/2011>
-- Description:	<Reporte de Precios Ajustados Proceso Automático>
-- =============================================
CREATE PROCEDURE [RepPreciosAjustadosPA]
	-- Add the parameters for the stored procedure here
	@cCoAjuste_d CHAR (20) = NULL ,
	@cCoAjuste_h CHAR (20) = NULL ,
	@sCo_Sucursal CHAR (6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

DECLARE @CADENA varchar(max)
DECLARE @CADENA1 varchar(max)
DECLARE @CADENA2 varchar(max)
DECLARE @CADENA3 varchar(max)
DECLARE @CADENA4 varchar(max)
DECLARE @CADENA5 varchar(max)
DECLARE @CADENA6 varchar(max)
DECLARE @CADENA7 varchar(max)
DECLARE @CADENA8 varchar(max)
DECLARE @CADENA9 varchar(max)
DECLARE @CADENA0 varchar(max)
DECLARE @CADENA11 varchar(max)
DECLARE @CADENA12 varchar(max)
DECLARE @DESCRIP varchar(max)
DECLARE @TIPAJU int

DECLARE campos_cursor CURSOR FOR 
SELECT P.campos, A.art_des, (CASE WHEN LTRIM(REVERSE(SUBSTRING(REVERSE(P.campos), 1, CHARINDEX(',', REVERSE(P.campos)) - 1))) = 'C' THEN 1 ELSE 0 END) AS tipo
FROM saPista P INNER JOIN saAjPrecioCostoAuto AP ON P.rowguidOri = AP.rowguid
				INNER JOIN SaArticulo A ON (SUBSTRING(P.campos, 1, CHARINDEX(',', campos) - 1)) = A.co_art
WHERE P.tablaori='pActualizarPrecioCostoAutomatico' AND AP.procesado = 1 
	AND( ( @cCoAjuste_d IS NULL
					OR AP.cod_ajuste >= @cCoAjuste_d
				  )
				  AND ( @cCoAjuste_h IS NULL
						OR AP.cod_ajuste <= @cCoAjuste_h
					  ))
 
	AND ( @sCo_Sucursal IS NULL
                  OR AP.co_sucu_in = @sCo_Sucursal
                )

OPEN campos_cursor
FETCH NEXT FROM campos_cursor
INTO @CADENA, @DESCRIP, @TIPAJU 

	WHILE @@FETCH_STATUS = 0
	BEGIN
		SELECT

		@CADENA1 = SUBSTRING(@CADENA, 1, CHARINDEX(',', @CADENA) - 1), --co_art
		@CADENA2 = SUBSTRING(@CADENA, CHARINDEX(',', @CADENA) +1, LEN(@CADENA)),

		@CADENA3 = SUBSTRING(@CADENA2, 1, CHARINDEX(',', @CADENA2) -1), -- co_alma
		@CADENA4 = SUBSTRING(@CADENA2, CHARINDEX(',', @CADENA2) +1, LEN(@CADENA2)),

		@CADENA5 = SUBSTRING(@CADENA4, 1, CHARINDEX(',', @CADENA4) -1), -- tipo_precio
		@CADENA6 = SUBSTRING(@CADENA4, CHARINDEX(',', @CADENA4) +1, LEN(@CADENA4)),

		@CADENA7 = SUBSTRING(@CADENA6, 1, CHARINDEX(',', @CADENA6) -1), -- fecha_desde
		@CADENA8 = SUBSTRING(@CADENA6, CHARINDEX(',', @CADENA6) +1, LEN(@CADEN
```
