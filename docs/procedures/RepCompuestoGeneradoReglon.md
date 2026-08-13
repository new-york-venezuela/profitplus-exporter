# SP: RepCompuestoGeneradoReglon
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepCompuestoGeneradoReglon
DESCRIPCION: Ajuste Entrada Salida con sus Caracteristica
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[RepCompuestoGeneradoReglon]
	-- Add the parameters for the stored procedure here
    @sCo_ArtComGen_d CHAR(20) = NULL ,
    @sCo_ArtComGen_h CHAR(20) = NULL ,
    @sCo_NumComGen_d CHAR(20) = NULL ,
    @sCo_NumComGen_h CHAR(20) = NULL ,
    @sdFec_Emis_d SMALLDATETIME = NULL ,
    @sdFec_Emis_h SMALLDATETIME = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCompuestoGen CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
 
    SET NOCOUNT ON;
 
select  
		e.co_art,a.modelo,a.art_des,
		e.co_uni,(case when e.gene_Art = '1' then 'Si' else 'No' END) as Gene_Art, e.gene_num,e.fecha,
		--r.co_uni as reg_uni, r.co_art,r.total_art,
		v.cantidad, 
		sub_01.subl_des as subl_des01, sub_02.subl_des as subl_des02,
		sub_03.subl_des as subl_des03,  sub_04.subl_des as subl_des04, 
		sub_05.subl_des as subl_des05
 from saArtCompuestoGen e 
		inner join saArticulo a on a.co_art= e.co_art
		left join savArtCaracteristicaGCOM v on e.gene_num = v.num_doc and tipo_doc = 'GCOM' -- Solo el encabezado
			left join sasublinea as sub_01 on sub_01.co_lin = v.co_lin01 and sub_01.co_subl = v.co_subl01
			left join sasublinea as sub_02 on sub_02.co_lin = v.co_lin02 and sub_02.co_subl = v.co_subl02
			left join sasublinea as sub_03 on sub_03.co_lin = v.co_lin03 and sub_03.co_subl = v.co_subl03
			left join sasublinea as sub_04 on sub_04.co_lin = v.co_lin04 and sub_04.co_subl = v.co_subl04
			left join sasublinea as sub_05 on sub_05.co_lin = v.co_lin05 and sub_05.co_subl = v.co_subl05
       -- select * from savArtCaracteristicaGCOM
	   --select * from saArtCompuestoGen 
         WHERE
			(@sCo_ArtComGen_d IS NULL OR e.co_art >= @sCo_ArtComGen_d)
		AND (@sCo_ArtComGen_h IS NULL OR e.co_art <= @sCo_ArtComGen_h)
		AND (@sCo_NumComGen_d IS NULL OR e.gene_num >= @sCo_NumComGen_d)
		AND (@sCo_NumComGen_h IS NULL OR e.gene_num <= @sCo_NumComGen_h)
		AND (@sdFec_Emis_d IS NULL OR  dbo.FechaSimple(e.fecha) >= @sdFec_Emis_d)
		AND (@sdFec_Emis_h IS NULL OR  dbo.FechaSimple(e.fecha) <= @sdFec_Emis_h)
		AND (@sCo_S
```
