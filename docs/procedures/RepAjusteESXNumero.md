# SP: RepAjusteESXNumero
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <17/05/2010>
-- Description:	<Ajuste de Entrada y Salida Por Numero>
-- =============================================
CREATE PROCEDURE [RepAjusteESXNumero] 
	-- Add the parameters for the stored procedure here
    @sCo_Numero_d CHAR(20) = NULL ,
    @sCo_Numero_h CHAR(20) = NULL ,
    @sCo_Fecha_d SMALLDATETIME = NULL ,
    @sCo_Fecha_h SMALLDATETIME = NULL ,
    @sCo_TipoAjuste CHAR(6) = NULL ,
    @sCo_Anulado CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(20) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
    -- Insert statements for procedure here

        DECLARE @sTipo_trans CHAR(6)
---Valores por defecto---
        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'ajue_num'

        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCo_Anulado IS NULL ) 
            SET @sCo_Anulado = 'TODO' 

        SET @sTipo_trans = ( SELECT
                                tipo_trans
                             FROM
                                saTipoAjuste
                             WHERE
                                co_tipo = @sCo_TipoAjuste
                           )
---Valores por defecto---

        SELECT
            @sCo_Anulado AS Filtro_Anulado, @sTipo_trans AS Filtro_tipo_trans, aj.ajue_num, aj.fecha, aj.motivo,
            aj.anulado, SUM(CASE WHEN ta.tipo_trans = 1 THEN total_art
                                 ELSE 0
                            END) AS total_art_S, SUM(CASE WHEN ta.tipo_trans = 0 THEN total_art
                                                          ELSE 0
                                                     END) AS total_art_E,
            SUM(CASE WHEN ta.tipo_trans = 1 THEN cost_unit * total_art
                     ELSE 0
                END) AS cost_Total_S, SUM(CASE WHEN ta.tipo_trans = 0 THEN cost_unit * total_art
                                               ELSE 0
                                          END) AS cost_Total_E
		--when ta.tipo_trans = 0 then cost_unit * [dbo].[ArtUnidadBase](AR.co_art,AR.co_uni,total_art) ELSE 0 EnD) AS cost_unitE
        FROM
            saAjuste AS AJ
            INNER JOIN saAjusteReng AS AR ON AJ.ajue_num = AR.ajue_num
            INNER JOIN saTipoAjuste AS TA ON AR.co_tipo = TA.co_tipo
        WHERE
```
