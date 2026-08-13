# SP: RepCrearArtFormaAut
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saArtCrearAut`](../tables/saArtCrearAut.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepCrearArtFormaAut
DESCRIPCION: Reporte de Crear Artículo de Forma Automatica
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[RepCrearArtFormaAut] 
-- Add the parameters for the stored procedure here
    @sCo_ArtCrearAut_d CHAR(6) = NULL ,
    @sCo_ArtCrearAut_h CHAR(6) = NULL ,
    @dFecha_d  smalldatetime = null,	
    @dFecha_h  smalldatetime = null,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
    
    SET NOCOUNT ON;
    
        SELECT 
            co_artCrearAut,ArtCrearAut_des, fecha_reg, (case when procesado = '1' then 'Procesado' else 'No Procesado' end) as procesado 
        FROM
            saArtCrearAut
		WHERE
				(@sCo_ArtCrearAut_d IS NULL OR @sCo_ArtCrearAut_d <= co_artCrearAut)
			AND (@sCo_ArtCrearAut_h IS NULL OR co_artCrearAut     <= @sCo_ArtCrearAut_h)
            AND (@dFecha_d IS NULL OR dbo.FechaSimple(fecha_reg)  >= @dFecha_d)
			AND (@dFecha_h IS NULL OR dbo.FechaSimple(fecha_reg)  <= @dFecha_h)
            AND (@sCo_Sucursal IS NULL OR co_sucu_in = @sCo_Sucursal)
		order by co_artCrearAut
       
 END
```
