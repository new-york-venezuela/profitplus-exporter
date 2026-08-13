# SP: RepInfContableArticulo
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`scCentro`](../tables/scCentro.md)
- [`scCuenta`](../tables/scCuenta.md)
- [`scGastos`](../tables/scGastos.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <2014-07-02>
 Description:	<Información Contable de Articulos>
 =============================================*/
CREATE PROCEDURE [dbo].[RepInfContableArticulo]
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_SLinea_d CHAR(6) = NULL ,
    @sCo_SLinea_h CHAR(6) = NULL ,
    @sCo_Categ_d CHAR(6) = NULL ,
    @sCo_Categ_h CHAR(6) = NULL ,
	@sCo_Cue_d CHAR(20) = NULL ,
	@sCo_Cue_h CHAR(20) = NULL ,
    @sCo_Gas_d CHAR(6) = NULL ,
	@sCo_Gas_h CHAR(6) = NULL ,
	@sCo_NumCarp_d CHAR(6) = NULL ,
	@sCo_NumCarp_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
 Select A.co_art, A.num_carp, A.Descripcion, case when ltrim(A.monto) = '' then 0 else cast(A.monto as decimal(18,5)) end as monto, 
 A.co_cue, A.co_gas, A.co_cen, A.des_cen, case when ltrim(A.porc) = '' then 0 else cast(A.porc as decimal(18,5)) end as porc,
 ART.art_des,
 CUE.des_cue,
 GAS.des_gas
  From ( 
Select	A.co_art, '01' as num_carp,
		A.dis_cen.query( '/InformacionContable/Carpeta01/Descripcion').value('/','varchar(128)') as Descripcion, 
		A.dis_cen.query( '/InformacionContable/Carpeta01/Monto').value('/','varchar(18)') as monto, 
		A.dis_cen.query( '/InformacionContable/Carpeta01/CuentaContable').value('/','varchar(20)') as co_cue, 
		A.dis_cen.query( '/InformacionContable/Carpeta01/CuentaGasto').value('/','varchar(8)') as co_gas, 
		C.N.value('(Codigo)[1]', 'varchar(6)') as co_cen,
		(select des_cen from scCentro where co_cen=C.N.value('(Codigo)[1]', 'varchar(6)')) as des_cen,
		C.N.value('(Porcentaje)[1]', 'varchar(12)') as porc
from	saArticulo A
		outer apply A.dis_cen.nodes('InformacionContable/Carpeta01/DistribucionCentros/CentroCosto') as C(N)
Where 
		((@sCo_Art_d IS NULL OR A.co_art >= @sCo_Art_d)			AND ( @sCo_Art_h IS NULL OR A.co_art <= @sCo_Art_h))
	AND	((@sCo_Linea_d IS NULL OR A.co_lin >= @sCo_Linea_d)		AND ( @sCo_Linea_h IS NULL OR A.co_lin <= @sCo_Linea_h))
	AND	((@sCo_SLinea_d IS NULL OR A.co_subl >= @sCo_SLinea_d)  AND ( @sCo_SLinea_h IS NULL OR A.co_subl <= @sCo_SLinea_h))
	AND	((@sCo_Categ_d IS NULL OR A.co_cat >= @sCo_Categ_d)		AND ( @sCo_Categ_h IS NULL OR A.co_cat <= @sCo_Categ_h))
	AND ( @sCo_Sucursal IS NULL OR A.
```
