# SP: RepGuiaDespachoTraslado
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saAdiCampo`](../tables/saAdiCampo.md)
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saSucursal`](../tables/saSucursal.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[RepGuiaDespachoTraslado]
	-- Add the parameters for the stored procedure here
    @sNum_des_d CHAR(16) = NULL ,
    @sNum_des_h CHAR(16) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
	
AS 
    BEGIN
        SET NOCOUNT ON ;

		declare @DirFis as nvarchar(254)
		declare @Telef as nvarchar(254)
	
		select @DirFis=val_str from saAdiCampo where co_adicampo = 'dir_fis'
		select @Telef=val_str from saAdiCampo where co_adicampo ='telef'

      SELECT
	  
            TR.co_art, A.modelo, A.art_des, TP.co_tran,
            TP.telefono, TP.contacto, TP.des_tran, tP.colorTransp, TP.resp_tra, TP.des_tran,

			 -- Función Tipo de Identificador 
           dbo.ObtenerTipoIdentificador(TP.tipoIdRespon) + TP.ident_responsable AS ident_responsable,
           dbo.ObtenerTipoIdentificador(Conductor.tipoIdCond) + Conductor.identificadorCond AS identificadorCond,

			TP.tipoIdRespon,
			
			TP.identificador_1, TP.identificador_2, TP.identificador_3, TP.resp_tra,
			TR.total_art, 

            '' AS tipo_doc, '' AS tipo_doc,
			(select co_uni_peso from par_emp) as co_peso, (select co_uni_volumen from par_emp) as co_volumen,
			A.peso , A.volumen, '' AS reng_neto,ISNULL(dbo.ArtUnidadBase(TR.co_art, TR.co_uni, TR.total_art),0) as TotalArtP,
		    '' AS prec_vta, dbo.ObtenerMonedaBase() as ObtenerMonedaBase, @DirFis as direccion ,@Telef as TelefonoEmpre, TP.clasificacion  AS clasificacion2,
			Conductor.identificador_1 as identificadorC_1 , Conductor.identificador_2 as identificadorC_2 ,  Conductor.identificador_3 as identificadorC_3 , Conductor.colorTransp as colorTranspConductor,
			Conductor.nomApelCond, Conductor.contactoCond, Conductor.tipoLicCond, Conductor.identificadorCond, Conductor.tipoIdCond,
			T.tras_num, T.fec_conf, T.fec_sal, T.confirma,T.motivo_glo,

			 --Descripciones de almacenes
            AlmOrig.des_alma AS des_alma_orig,
            AlmDest.des_alma AS des_alma_dest,

			 --Direcciones 
            AlmOrig.direccion AS direccion_origen,
            AlmDest.direccion AS direccion_destino,

			 --Descripciones de sucursales
            SucurOrig.sucur_des AS Sucursal_Origen,
            SucurDest.sucur_des AS Sucursal_Destino,

		     T.confirma  AS Confirma

        FROM
		    saTraslado AS T

			INNER JOIN saTrasladoReng AS TR ON T.tras_num = TR.tras_num

		    LEFT JOIN saTransporte
```
